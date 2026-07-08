// Tool surface for the chat agent (math for the meter, LLM for the judgment).
// Every read tool wraps an existing engine function; the two action tools run
// through the guardrail in policy.ts before (simulated) execution. The model
// NEVER computes a figure these tools can provide.

import { readFileSync } from "node:fs";
import { detectAnomalies } from "../src/anomaly";
import { attribute, topEntries, type AttributionResult } from "../src/attribution";
import { forecast } from "../src/forecast";
import { meterEvents, type MeterResult, type RatedEvent } from "../src/meter";
import { routingEconomics } from "../src/routing-economics";
import type { GeneratorConfig, UsageEvent } from "../src/schema";
import { buildWindowSummary } from "../src/summarize";
import { checkGuardrail, type GuardrailDecision, type Role } from "./policy";

const MONTHLY_BUDGET = 3000; // mirrors src/app/config.ts (see its derivation comment)

export interface ToolContext {
  role: Role;
  asOfDay?: string; // defaults to the last day with data
}

export interface ToolEvent {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
}

interface View {
  config: GeneratorConfig;
  metered: MeterResult;
  attributed: AttributionResult;
  allDays: string[];
  elapsedDays: string[];
  asOfDay: string;
}

export interface ExecutedAction {
  at: string;
  tool: string;
  input: Record<string, unknown>;
  decision: GuardrailDecision;
}

export function createToolExecutor(dataFile: string) {
  const { config, events } = JSON.parse(readFileSync(dataFile, "utf8")) as {
    config: GeneratorConfig;
    events: UsageEvent[];
  };
  const allDays = [...new Set(events.map((e) => e.timestamp.slice(0, 10)))].sort();
  const viewCache = new Map<string, View>();
  const actionLog: ExecutedAction[] = [];

  function view(asOfDay?: string): View {
    const day = asOfDay && allDays.includes(asOfDay) ? asOfDay : allDays[allDays.length - 1];
    let v = viewCache.get(day);
    if (!v) {
      const toDate = events.filter((e) => e.timestamp.slice(0, 10) <= day);
      const metered = meterEvents(toDate, config.commitments ?? []);
      v = {
        config,
        metered,
        attributed: attribute(metered.events),
        allDays,
        elapsedDays: allDays.filter((d) => d <= day),
        asOfDay: day,
      };
      viewCache.set(day, v);
    }
    return v;
  }

  const fc = (v: View) =>
    forecast(v.metered.events, v.metered.commitments, v.config.commitments ?? [], v.allDays, v.asOfDay, MONTHLY_BUDGET);

  /** Feature's rated window cost scaled to a 30-day run-rate. */
  function monthlyRunRate(v: View, feature: string): number {
    const cost = v.metered.events
      .filter((e) => e.feature === feature)
      .reduce((a, e) => a + e.rated_cost, 0);
    const days = v.elapsedDays.length;
    return days > 0 ? Math.round((cost / days) * 30 * 100) / 100 : 0;
  }

  function dailySeries(v: View, sliceBy: string, key?: string) {
    const match = (e: RatedEvent) =>
      sliceBy === "resource_type" ? e.resource_type === key
      : sliceBy === "model" ? e.model === key
      : sliceBy === "feature" ? e.feature === key
      : true;
    const byDay = new Map<string, number>();
    for (const day of v.elapsedDays) byDay.set(day, 0);
    for (const e of v.metered.events) {
      if (key !== undefined && !match(e)) continue;
      const day = e.timestamp.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + e.rated_cost);
    }
    return {
      slice_by: sliceBy,
      key: key ?? "(total)",
      series: [...byDay.entries()].map(([day, cost]) => ({ day, cost: Math.round(cost * 100) / 100 })),
    };
  }

  function execute(name: string, input: Record<string, unknown>, ctx: ToolContext): unknown {
    const v = view(ctx.asOfDay);
    switch (name) {
      case "get_spend_summary":
        return buildWindowSummary(v.config, v.metered, v.attributed, fc(v), detectAnomalies(v.metered.events, v.elapsedDays));
      case "get_attribution": {
        const dimension = String(input.dimension ?? "resource_type");
        const dimMap: Record<string, keyof AttributionResult> = {
          resource_type: "byResourceType", provider: "byProvider", model: "byModel",
          feature: "byFeature", team: "byTeam", customer: "byCustomer", user: "byUser", seat: "bySeat",
          workload: "byWorkload",
        };
        const dimKey = dimMap[dimension];
        if (!dimKey) return { error: `unknown dimension "${dimension}"` };
        const dim = v.attributed[dimKey] as Record<string, { cost: number; share: number; events: number }>;
        return {
          dimension,
          total_cost: v.attributed.totalCost,
          entries: topEntries(dim, Number(input.limit ?? 8)).map(([key, r]) => ({ key, ...r })),
        };
      }
      case "get_daily_series":
        return dailySeries(v, String(input.slice_by ?? "resource_type"), input.key === undefined ? undefined : String(input.key));
      case "get_anomalies":
        return detectAnomalies(v.metered.events, v.elapsedDays);
      case "get_forecast":
        return fc(v);
      case "get_commitment_status":
        return v.metered.commitments;
      case "get_routing_economics":
        return routingEconomics(v.metered.events, String(input.feature ?? ""), v.elapsedDays.length);
      case "cap_budget": {
        const feature = String(input.feature ?? "");
        const amount = Number(input.monthly_amount_usd ?? 0);
        const runRate = monthlyRunRate(v, feature);
        const decision = checkGuardrail(
          { tool: "cap_budget", feature, estimatedMonthlyImpactUsd: Math.max(0, runRate - amount) },
          ctx.role,
        );
        if (decision.verdict === "allow") {
          actionLog.push({ at: new Date().toISOString(), tool: "cap_budget", input, decision });
        }
        return {
          action: "cap_budget",
          feature,
          requested_cap_usd: amount,
          current_monthly_run_rate_usd: runRate,
          ...decision,
          executed: decision.verdict === "allow",
          simulation_note: decision.verdict === "allow"
            ? "Simulated: cap recorded in the action log for this server session; no live workload was modified (POC)."
            : undefined,
        };
      }
      case "throttle_workload": {
        const feature = String(input.feature ?? "");
        // Throttling holds ALL of the feature's traffic — impact is its full run-rate.
        const runRate = monthlyRunRate(v, feature);
        const decision = checkGuardrail(
          { tool: "throttle_workload", feature, estimatedMonthlyImpactUsd: runRate },
          ctx.role,
        );
        if (decision.verdict === "allow") {
          actionLog.push({ at: new Date().toISOString(), tool: "throttle_workload", input, decision });
        }
        return {
          action: "throttle_workload",
          feature,
          current_monthly_run_rate_usd: runRate,
          ...decision,
          executed: decision.verdict === "allow",
          simulation_note: decision.verdict === "allow"
            ? "Simulated: throttle recorded in the action log for this server session; no live workload was modified (POC)."
            : undefined,
        };
      }
      default:
        return { error: `unknown tool "${name}"` };
    }
  }

  return { execute, actionLog, allDays };
}

// Anthropic tool definitions — descriptions state WHEN to call each tool
// (prescriptive triggers lift should-call rate on Opus models).
export const TOOL_DEFS = [
  {
    name: "get_spend_summary",
    description:
      "Get the full picture of the current spend window: totals, forecast vs budget, top slices by resource/model/feature, commitment status, and any detected anomalies. Call this FIRST for any broad question like 'how is my spend looking'.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_attribution",
    description:
      "Break down rated spend by one dimension. Call when the user asks who/what is driving spend, or for a ranked list by provider, model, feature, team, customer, user, or seat-vs-autonomous.",
    input_schema: {
      type: "object",
      properties: {
        dimension: {
          type: "string",
          enum: ["resource_type", "provider", "model", "feature", "team", "customer", "user", "seat", "workload"],
        },
        limit: { type: "integer", description: "max entries, default 8" },
      },
      required: ["dimension"],
    },
  },
  {
    name: "get_daily_series",
    description:
      "Get the per-day rated cost series, optionally for one slice (e.g. resource_type=llm, or one model/feature). Call when the user asks about trends over time or when a chart of the spike would help.",
    input_schema: {
      type: "object",
      properties: {
        slice_by: { type: "string", enum: ["resource_type", "model", "feature"] },
        key: { type: "string", description: "slice value, e.g. 'llm' or 'draft_reply'; omit for the blended total" },
      },
      required: ["slice_by"],
    },
  },
  {
    name: "get_anomalies",
    description:
      "Get detected spend anomalies with full threshold math: type (cost_mix vs volume), peak ratio vs trailing median, drivers by model/feature, cumulative excess, and whether the blended invoice total would have caught it. Call whenever the user asks about a spike, surprise, or 'what happened'.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_forecast",
    description:
      "Get the projected window-end spend vs budget with the fixed/variable/overage split. Call when the user asks about budget, month-end, or whether spend is on track.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_commitment_status",
    description:
      "Get utilization of committed-use contracts (underutilized = overpaying, overage = renegotiate). Call when the user asks about commitments, contracts, or savings opportunities beyond model routing.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_routing_economics",
    description:
      "Compute, for one feature, per-model cost and the counterfactual cost if all calls routed to the cheapest observed model, including estimated monthly savings. ALWAYS call this before quoting any routing-change savings figure — never estimate savings yourself.",
    input_schema: {
      type: "object",
      properties: { feature: { type: "string", description: "feature name, e.g. 'draft_reply'" } },
      required: ["feature"],
    },
  },
  {
    name: "cap_budget",
    description:
      "ACTION: set a monthly budget cap on one feature. Only call when the user explicitly asks to cap, limit, or enforce a budget. The request is checked against the guardrail policy (role + authority limit) before executing; it may be held and escalated — report the verdict either way.",
    input_schema: {
      type: "object",
      properties: {
        feature: { type: "string" },
        monthly_amount_usd: { type: "number" },
      },
      required: ["feature", "monthly_amount_usd"],
    },
  },
  {
    name: "throttle_workload",
    description:
      "ACTION: hold a feature's traffic before its spend lands. Only call when the user explicitly asks to throttle, pause, or stop a workload. Checked against the guardrail policy before executing; may be held and escalated — report the verdict either way.",
    input_schema: {
      type: "object",
      properties: { feature: { type: "string" } },
      required: ["feature"],
    },
  },
] as const;
