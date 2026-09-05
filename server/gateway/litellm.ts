// LiteLLM reference adapter (BACKLOG items 8, 11, 26, 29).
//
// Ingestion shape: push — LiteLLM success-callback / spend-log webhook bodies.
// Enforcement: POST /key/update against the proxy admin API (max_budget,
// rpm_limit, models). When the write cannot complete, the result is an
// explicit alert-only — never a silent no-op.
//
// LiteLLM's own spend figure is authoritative for `cost`; we do not
// re-price tokens. Attribution fields come from key metadata via
// applyAttributionMapping (customer-config), not hardcoded aliases.

import { applyAttributionMapping } from "./attribution";
import type {
  AttributionMapping,
  GatewayAdapter,
  GatewayAdapterInfo,
  IngestionInput,
  IngestionResult,
  PolicySpec,
  PolicySyncResult,
} from "./types";
import type { PricingModel, Unit, UsageEvent } from "../../src/schema";

export const LITELLM_DEFAULT_MAPPING: AttributionMapping = {
  fields: {
    workload_id: "user_api_key_alias",
    team_id: "user_api_key_team_id",
    user_id: "user_api_key_user_id",
    customer_id: "customer_id",
    feature: "feature",
  },
};

export interface LiteLLMConfig {
  baseUrl: string;
  masterKey: string;
  mapping?: AttributionMapping;
  /** workload_id → virtual key used as the /key/update target. */
  workloadKeys?: Record<string, string>;
  fetch?: typeof fetch;
}

export class LiteLLMGatewayAdapter implements GatewayAdapter {
  readonly info = {
    id: "litellm",
    display_name: "LiteLLM",
    ingestion: "push",
    enforcement: "enforced",
  } as const satisfies GatewayAdapterInfo;

  private readonly mapping: AttributionMapping;
  private readonly workloadKeys: Record<string, string>;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly masterKey: string;

  constructor(config: LiteLLMConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.masterKey = config.masterKey;
    this.mapping = config.mapping ?? LITELLM_DEFAULT_MAPPING;
    this.workloadKeys = config.workloadKeys ?? {};
    this.fetchFn = config.fetch ?? fetch;
  }

  async ingestUsageEvents(input: IngestionInput): Promise<IngestionResult> {
    if (input.kind !== "push") {
      throw new Error("litellm is a push adapter; got a poll input");
    }
    const events: UsageEvent[] = [];
    const dropped: IngestionResult["dropped"] = [];
    for (const raw of unwrapPayloads(input.payload)) {
      const parsed = normalizeSpendLog(raw, input.received_at, this.mapping);
      if ("event" in parsed) events.push(parsed.event);
      else dropped.push({ raw, reason: parsed.reason });
    }
    return { events, cursor: null, dropped };
  }

  async syncPolicy(policy: PolicySpec): Promise<PolicySyncResult> {
    const key = this.workloadKeys[policy.workload_id];
    if (!key) {
      return {
        mode: "alert-only",
        reason: "rejected",
        detail: `no virtual key mapped for workload_id=${policy.workload_id}`,
      };
    }

    const body = policyBody(policy, key);
    try {
      const res = await this.fetchFn(`${this.baseUrl}/key/update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.masterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          mode: "alert-only",
          reason: "rejected",
          detail: `LiteLLM /key/update ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        };
      }
      const json = (await res.json().catch(() => ({}))) as { key?: string; token?: string };
      return { mode: "enforced", gateway_ref: json.key ?? json.token ?? key };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { mode: "alert-only", reason: "gateway_unreachable", detail: message };
    }
  }
}

function policyBody(policy: PolicySpec, key: string): Record<string, unknown> {
  switch (policy.kind) {
    case "budget_cap":
      return { key, max_budget: policy.monthly_usd, budget_duration: "30d" };
    case "rate_limit":
      return { key, rpm_limit: policy.requests_per_minute };
    case "model_allowlist":
      return { key, models: policy.models };
  }
}

/** Accept a single spend log, an array, or a { spend_logs | logs } wrapper. */
export function unwrapPayloads(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.spend_logs)) return o.spend_logs;
    if (Array.isArray(o.logs)) return o.logs;
    if (o.standard_logging_object && typeof o.standard_logging_object === "object") {
      return [o.standard_logging_object];
    }
    return [payload];
  }
  return [payload];
}

function normalizeSpendLog(
  raw: unknown,
  receivedAt: string,
  mapping: AttributionMapping,
): { event: UsageEvent } | { reason: string } {
  if (!raw || typeof raw !== "object") return { reason: "not an object" };
  const rec = raw as Record<string, unknown>;

  const spend = asFiniteNumber(rec.spend ?? rec.response_cost ?? rec.cost);
  if (spend === undefined) return { reason: "missing numeric spend" };

  const prompt = asFiniteNumber(rec.prompt_tokens) ?? 0;
  const completion = asFiniteNumber(rec.completion_tokens) ?? 0;
  const total =
    asFiniteNumber(rec.total_tokens) ??
    (prompt + completion > 0 ? prompt + completion : undefined);

  let quantity: number;
  let unit: Unit;
  let pricing_model: PricingModel;
  if (total !== undefined && total > 0) {
    quantity = total;
    unit = "tokens";
    pricing_model = "per_token";
  } else {
    quantity = 1;
    unit = "calls";
    pricing_model = "per_call";
  }

  const modelRaw = typeof rec.model === "string" ? rec.model : null;
  const provider =
    (typeof rec.custom_llm_provider === "string" && rec.custom_llm_provider) ||
    providerFromModel(modelRaw) ||
    "unknown";

  const timestamp =
    asIso(rec.endTime) ?? asIso(rec.startTime) ?? asIso(rec.end_time) ?? asIso(rec.start_time) ?? receivedAt;

  const source = flattenSource(rec);
  const attrs = applyAttributionMapping(source, mapping);

  // LiteLLM's spend is the billed figure. Do not round unit_cost to 6dp
  // before the meter — 0.0482/1600 is 3.0125e-5, which 6dp would clip to
  // 3e-5 and silently drop two hundredths of a cent.
  const unit_cost = quantity > 0 ? spend / quantity : spend;
  const event: UsageEvent = {
    timestamp,
    customer_id: attrs.customer_id,
    team_id: attrs.team_id,
    workload_id: attrs.workload_id,
    user_id: attrs.user_id,
    feature: attrs.feature,
    resource_type: "llm",
    provider,
    model: modelRaw ? modelRaw.split("/").pop() ?? modelRaw : null,
    pricing_model,
    quantity,
    unit,
    unit_cost,
    cost: spend,
  };
  return { event };
}

function flattenSource(rec: Record<string, unknown>): Record<string, unknown> {
  const meta = isRecord(rec.metadata) ? rec.metadata : {};
  const spendMeta = isRecord(meta.spend_logs_metadata)
    ? meta.spend_logs_metadata
    : isRecord(rec.spend_logs_metadata)
      ? rec.spend_logs_metadata
      : {};
  return { ...rec, ...meta, ...spendMeta };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asIso(v: unknown): string | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}

function providerFromModel(model: string | null): string | undefined {
  if (!model) return undefined;
  const slash = model.indexOf("/");
  if (slash > 0) return model.slice(0, slash);
  return undefined;
}
