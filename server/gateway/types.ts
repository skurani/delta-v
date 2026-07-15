// GatewayAdapter — the seam between Delta-V and any gateway (M2, BACKLOG
// item 29). Adapters normalize gateway usage into FOCUS-flavored UsageEvents
// (ingest) and write policy to the gateway's admin API (enforce). Everything
// downstream of this interface is gateway-agnostic: the engine never imports
// from server/gateway/, and no adapter redefines the schema.
//
// Two ingestion shapes are first-class so the design isn't accidentally
// LiteLLM-specific: push (callback/webhook stream, e.g. LiteLLM success
// callbacks) and poll (cursor-based pull, e.g. OpenRouter analytics). The
// transport difference lives in the harness (webhook endpoint vs scheduler);
// the normalization difference lives in the adapter; downstream sees only
// IngestionResult.

import type { UsageEvent } from "../../src/schema";

export type IngestionShape = "push" | "poll";

/** Enforcement-mode vocabulary (BACKLOG item 11): every cap carries an
    explicit mode — never imply teeth that don't exist. */
export type EnforcementMode = "enforced" | "delegated" | "alert-only";

export interface GatewayAdapterInfo {
  id: string; // "litellm", "openrouter", "stub"
  display_name: string;
  ingestion: IngestionShape;
  /** BEST capability. "alert-only" declares an ingestion-only adapter up
      front, so the UI can label the source before any cap is attempted. */
  enforcement: EnforcementMode;
}

export type IngestionInput =
  | { kind: "push"; payload: unknown; received_at: string } // one raw callback/webhook body
  | { kind: "poll"; cursor: string | null }; // resume position; null = first poll

export interface DroppedRecord {
  raw: unknown;
  reason: string;
}

export interface IngestionResult {
  events: UsageEvent[];
  /** Poll adapters: opaque resume position for the next poll — re-poll dedupe
      and the analytics-window boundary live here (BACKLOG item 27). Push
      adapters: always null. */
  cursor: string | null;
  /** Records that could not normalize — returned, never silently discarded,
      so ingest totals always reconcile (honest-degradation principle). */
  dropped: DroppedRecord[];
}

export type PolicySpec =
  | { kind: "budget_cap"; workload_id: string; monthly_usd: number }
  | { kind: "rate_limit"; workload_id: string; requests_per_minute: number }
  | { kind: "model_allowlist"; workload_id: string; models: string[] };

export type AlertOnlyReason =
  | "unsupported" // adapter is ingestion-only (declared in info.enforcement)
  | "gateway_unreachable" // capable adapter, write failed — degraded, not silent
  | "rejected"; // gateway refused the write

/** Discriminated so alert-only is structurally required to carry a reason —
    an ingestion-only adapter cannot silently no-op, and a capable adapter
    that can't reach its gateway degrades to the same explicit shape. */
export type PolicySyncResult =
  | { mode: "enforced"; gateway_ref?: string } // written; the gateway will cut off
  | { mode: "delegated"; delivered_to: string } // handed to customer infra (webhook)
  | { mode: "alert-only"; reason: AlertOnlyReason; detail?: string };

export interface GatewayAdapter {
  /** Static identity + declared capabilities — how the harness and UI know
      what this adapter can do without calling it. */
  readonly info: GatewayAdapterInfo;

  /** Normalize gateway usage into FOCUS-flavored UsageEvents. Adapters throw
      on an input kind that doesn't match info.ingestion (harness bug) rather
      than returning empty — a silent empty would read as "no usage". */
  ingestUsageEvents(input: IngestionInput): Promise<IngestionResult>;

  /** Write policy to the gateway's admin API. Ingestion-only adapters return
      an explicit alert-only result — never a silent no-op. */
  syncPolicy(policy: PolicySpec): Promise<PolicySyncResult>;
}

// ---------------------------------------------------------------------------
// Attribution mapping (BACKLOG item 3) — the customer-config half of
// normalization. Gateway-specific extraction (where in the payload the
// metadata sits) is adapter code; WHICH source attribute means workload_id
// or team_id is per-install config, applied via applyAttributionMapping.
// ---------------------------------------------------------------------------

export type AttributionField = "workload_id" | "feature" | "team_id" | "customer_id" | "user_id";

export interface AttributionMapping {
  /** UsageEvent field ← name of the source attribute that fills it. */
  fields: Partial<Record<AttributionField, string>>;
  /** Fallback bucket for unmapped/missing attributes (default "unattributed")
      — totals must reconcile under partial tagging. */
  unattributed_value?: string;
}
