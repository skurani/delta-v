// Chat model behind one interface (SPEC §6 + mock mode).
//
// Two implementations, identical response shape (Anthropic Messages API:
// content blocks + stop_reason), so the agent loop cannot tell them apart:
//   RealChatModel — claude-opus-4-8 via @anthropic-ai/sdk
//   MockChatModel — scripted golden-path responses (USE_MOCK_LLM=true).
//
// The mock emits the same tool_use blocks the real model would, and its
// narrations are TEMPLATED FROM THE ACTUAL TOOL RESULTS in the conversation
// — the pipeline (tool execution, guardrail, charts) runs for real; only the
// model's decision-making is canned. Numbers stay honest either way.

import Anthropic from "@anthropic-ai/sdk";
import { ROLE_LABEL, type Role } from "./policy";
import { TOOL_DEFS } from "./tools";

export interface AgentBlock {
  type: string;
  [key: string]: unknown;
}

export interface AgentTurn {
  stop_reason: string | null;
  content: AgentBlock[];
}

export interface ChatModel {
  chat(system: string, messages: unknown[]): Promise<AgentTurn>;
}

export const MODEL_ID = "claude-opus-4-8";

// ---------------------------------------------------------------------------
// Real path
// ---------------------------------------------------------------------------

class RealChatModel implements ChatModel {
  private client = new Anthropic();

  async chat(system: string, messages: unknown[]): Promise<AgentTurn> {
    const response = await this.client.messages.create({
      model: MODEL_ID,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // Breakpoint on the system block caches tools + system as one stable
      // prefix; conversation history accrues cache reads as it grows.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: TOOL_DEFS as unknown as Anthropic.Messages.ToolUnion[],
      messages: messages as Anthropic.Messages.MessageParam[],
    });
    return { stop_reason: response.stop_reason, content: response.content as AgentBlock[] };
  }
}

// ---------------------------------------------------------------------------
// Mock path — scripted golden-path decision-making
// ---------------------------------------------------------------------------

const usd = (x: number) => "$" + Number(x).toFixed(2);
const roleLabel = (r: string) => ROLE_LABEL[r as Role] ?? r;

type ToolResults = Map<string, unknown>; // tool name → parsed result

interface Script {
  match: (q: string) => boolean;
  toolCalls: (q: string) => { name: string; input: Record<string, unknown> }[];
  narrate: (results: ToolResults, q: string) => string;
}

const parseCapAmount = (q: string): number => {
  const m = q.match(/\$?\s?(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 20;
};

const parseFeature = (q: string): string => {
  const known = ["draft_reply", "triage", "lookup_order", "eligibility_check", "batch_indexing", "observability"];
  return known.find((f) => q.includes(f)) ?? "draft_reply";
};

const SCRIPTS: Script[] = [
  {
    // Beat 4/5: "cap the draft_reply budget at $20" — the guardrail moment.
    match: (q) => /\bcap\b|\blimit\b|enforce/.test(q),
    toolCalls: (q) => [
      { name: "cap_budget", input: { feature: parseFeature(q), monthly_amount_usd: parseCapAmount(q) } },
    ],
    narrate: (results) => {
      const r = results.get("cap_budget") as Record<string, any> | undefined;
      if (!r) return "I attempted the cap but received no result.";
      if (r.verdict === "hold") {
        return `I attempted the cap, and the guardrail held it. Requested cap: ${usd(r.requested_cap_usd)}/mo on ${r.feature}, which currently runs at ${usd(r.current_monthly_run_rate_usd)}/mo — an estimated impact of ${usd(r.policy.estimated_monthly_impact_usd)}/mo. ${r.policy.role === "member" ? `Policy requires the ${roleLabel(r.policy.required_role)} role to execute actions; your current role is ${roleLabel(r.policy.role)}.` : `That exceeds my ${usd(r.policy.authority_limit_usd)}/mo autonomous-action authority.`} The action is escalated for approval rather than executed — nothing was changed.`;
      }
      return `Done — cap executed. ${r.feature} is now capped at ${usd(r.requested_cap_usd)}/mo against a current run-rate of ${usd(r.current_monthly_run_rate_usd)}/mo (estimated impact ${usd(r.policy.estimated_monthly_impact_usd)}/mo, within my ${usd(r.policy.authority_limit_usd)}/mo authority). ${r.simulation_note ?? ""}`;
    },
  },
  {
    match: (q) => /throttle|pause the|stop the/.test(q),
    toolCalls: (q) => [{ name: "throttle_workload", input: { feature: parseFeature(q) } }],
    narrate: (results) => {
      const r = results.get("throttle_workload") as Record<string, any> | undefined;
      if (!r) return "I attempted the throttle but received no result.";
      return r.verdict === "hold"
        ? `I attempted to throttle ${r.feature}, and the guardrail held it: throttling holds the feature's full ${usd(r.current_monthly_run_rate_usd)}/mo run-rate, ${r.policy.role === "member" ? `and actions require the ${roleLabel("admin")} role (current: ${roleLabel(r.policy.role)})` : `which exceeds my ${usd(r.policy.authority_limit_usd)}/mo authority`}. Escalated for approval — nothing was changed.`
        : `Throttle executed on ${r.feature} (run-rate ${usd(r.current_monthly_run_rate_usd)}/mo). ${r.simulation_note ?? ""}`;
    },
  },
  {
    // Beat 2: "why did my LLM spend spike?"
    match: (q) => /spike|spiked|jump|surge|what happened|anomal/.test(q),
    toolCalls: () => [
      { name: "get_anomalies", input: {} },
      { name: "get_daily_series", input: { slice_by: "resource_type", key: "llm" } },
    ],
    narrate: (results) => {
      const alerts = results.get("get_anomalies") as any[] | undefined;
      if (!alerts || alerts.length === 0)
        return "I checked the anomaly detector — no slice is currently firing above threshold. Spend is within normal variance.";
      const a = alerts[0];
      const drivers = a.drivers
        .map((d: any) => `${d.slice} peaked at ${d.peakRatio}x baseline`)
        .join("; ");
      return `Your ${a.episode.slice} spend spiked starting ${a.episode.startDay}: it peaked at ${usd(a.episode.peakCost)} on ${a.episode.peakDay} — ${a.episode.peakRatio}x the trailing 14-day median of ${usd(a.episode.peakBaseline)}, with ${usd(a.episode.cumulativeExcess)} cumulative excess. This is a ${a.type === "cost_mix" ? "cost-mix" : "volume"} anomaly: cost per event rose ${a.episode.unitEconRatio}x, so the mix shifted toward expensive units rather than usage simply growing. Drivers: ${drivers}. Note: the blended daily total moved only ${a.invoiceCheck.totalRatio}x that day — this spike is invisible at the invoice level, which is exactly why the meter watches each slice.`;
    },
  },
  {
    // Beat 3: "what would fixing it save?"
    match: (q) => /save|savings|fix|cheaper|route|routing|optimi[sz]e/.test(q),
    toolCalls: (q) => [{ name: "get_routing_economics", input: { feature: parseFeature(q) } }],
    narrate: (results) => {
      const r = results.get("get_routing_economics") as Record<string, any> | undefined;
      if (!r || r.error) return `I couldn't compute routing economics: ${r?.error ?? "no result"}.`;
      const top = r.models[0];
      return `The lever is model routing on ${r.feature}. ${top.model} carries ${usd(top.cost)} of the feature's ${usd(r.current_window_cost)} window cost (${(top.share_of_feature_cost * 100).toFixed(0)}% from ${top.events.toLocaleString()} calls). At the same token volume routed to ${r.cheapest_model}, the window would cost ${usd(r.window_cost_if_all_cheapest)} — saving ${usd(r.window_savings)} this window, roughly ${usd(r.estimated_monthly_savings)}/mo. Caveat from the engine: ${r.note} My recommendation: route routine ${r.feature} calls to ${r.cheapest_model} and reserve the frontier model for escalations. I can also cap the feature's budget if you want enforcement — say the word.`;
    },
  },
  {
    match: (q) => /commit|contract|underutil|overage/.test(q),
    toolCalls: () => [{ name: "get_commitment_status", input: {} }],
    narrate: (results) => {
      const cs = results.get("get_commitment_status") as any[] | undefined;
      if (!cs || cs.length === 0) return "No commitment contracts are on file for this window.";
      return cs
        .map((c) =>
          c.status === "underutilized"
            ? `${c.provider}/${c.feature}: ${(c.utilization * 100).toFixed(1)}% of the ${c.includedQuantity.toLocaleString()} ${c.unit} commit used — you pay ${usd(c.committedCost)}/mo regardless, so this is over-provisioned; right-size at renewal.`
            : c.status === "overage"
              ? `${c.provider}/${c.feature}: ${(c.utilization * 100).toFixed(1)}% used — past the commit, ${usd(c.overageCost)} in overage; renegotiate the tier.`
              : `${c.provider}/${c.feature}: ${(c.utilization * 100).toFixed(1)}% used — on track.`,
        )
        .join(" ");
    },
  },
  {
    // Heatmap beat: "show me the cost heatmap" — MUST precede the summary
    // script, whose "spend|cost" keywords would otherwise swallow it.
    match: (q) => /heat[- ]?map|matrix|cross[- ]?tab|feature and model|by feature.{0,12}model/.test(q),
    toolCalls: () => [{ name: "get_cost_matrix", input: {} }],
    narrate: (results) => {
      const m = results.get("get_cost_matrix") as Record<string, any> | undefined;
      if (!m || m.cells.length === 0)
        return "I computed the cost matrix but there is no LLM spend in this window.";
      const hot = m.cells[0];
      const share = m.total_cost > 0 ? ((hot.cost / m.total_cost) * 100).toFixed(0) : "0";
      return `Here's the ${m.row_dimension} × ${m.col_dimension} matrix of LLM spend (${m.rows.length} features × ${m.cols.length} models, ${usd(m.total_cost)} total — LLM events only; committed/flat spend has no model dimension). The hottest cell is ${hot.row} × ${hot.col}: ${usd(hot.cost)} across ${hot.events.toLocaleString()} calls — ${share}% of all LLM spend concentrated in one combination. Click any cell to drill into the underlying events, or pin the heatmap to the canvas.`;
    },
  },
  {
    // Beat 1: "how's my spend looking?"
    match: (q) => /spend|looking|overview|budget|month|on track|status|cost|forecast|burn|how are we/.test(q),
    toolCalls: () => [
      { name: "get_spend_summary", input: {} },
      { name: "get_daily_series", input: { slice_by: "resource_type" } },
    ],
    narrate: (results) => {
      const s = results.get("get_spend_summary") as Record<string, any> | undefined;
      if (!s) return "I pulled the window summary but received no result.";
      const f = s.forecast;
      const anomalyNote =
        s.anomalies.length > 0
          ? ` One flag: the detector has an active ${s.anomalies[0].type === "cost_mix" ? "cost-mix" : "volume"} anomaly on the ${s.anomalies[0].slice} slice (peak ${s.anomalies[0].peak_ratio}x baseline) — ask me about the spike for details.`
          : " No anomalies are currently firing.";
      return `Through day ${s.window.days_elapsed} of ${s.window.days_total}, you've spent ${usd(s.totals.rated_cost_to_date)} and the window is projected to end at ${usd(f.projected_window_total)} against a ${usd(f.budget)} budget — ${f.variance > 0 ? usd(f.variance) + " over" : usd(-f.variance) + " under"}, status ${f.status}. Spend is dominated by ${s.by_resource_type[0].key} (${usd(s.by_resource_type[0].cost)}, ${(s.by_resource_type[0].share * 100).toFixed(0)}%). Variable burn is ${usd(f.variable_daily_burn)}/day.${anomalyNote}`;
    },
  },
  {
    // True fallback: off-script question in mock mode — say so, call nothing.
    match: () => true,
    toolCalls: () => [],
    narrate: () =>
      `(Mock mode) I'm the scripted stand-in for the real model and only handle the golden-path questions:\n` +
      `· "How's my spend looking this month?"\n` +
      `· "Why did my LLM spend spike?"\n` +
      `· "What would fixing it save?"\n` +
      `· "Show me the cost heatmap"\n` +
      `· "Cap the draft_reply budget at $20/mo" (or throttle/commitment questions)\n` +
      `Run the server without USE_MOCK_LLM (with an API key) for free-form questions.`,
  },
];

class MockChatModel implements ChatModel {
  async chat(_system: string, messages: unknown[]): Promise<AgentTurn> {
    const msgs = messages as { role: string; content: unknown }[];

    // Find the latest real user question (a user turn with text, not tool_results),
    // and count assistant turns since — 0 → emit tool calls, 1+ → narrate.
    let questionIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role !== "user") continue;
      const text = extractUserText(m.content);
      if (text !== null) {
        questionIdx = i;
        break;
      }
    }
    const question = questionIdx >= 0 ? extractUserText(msgs[questionIdx].content)!.toLowerCase() : "";
    const step = msgs.slice(questionIdx + 1).filter((m) => m.role === "assistant").length;
    const script = SCRIPTS.find((s) => s.match(question))!;

    if (step === 0) {
      const calls = script.toolCalls(question);
      // Scripts with no tool calls (the off-script fallback) answer directly.
      if (calls.length > 0) {
        return {
          stop_reason: "tool_use",
          content: calls.map((call, i) => ({
            type: "tool_use",
            id: `toolu_mock_${questionIdx}_${i}`,
            name: call.name,
            input: call.input,
          })),
        };
      }
    }

    // Narration step: collect tool results from the conversation since the question.
    const idToName = new Map<string, string>();
    const results: ToolResults = new Map();
    for (const m of msgs.slice(questionIdx + 1)) {
      if (!Array.isArray(m.content)) continue;
      for (const block of m.content as AgentBlock[]) {
        if (block.type === "tool_use") idToName.set(String(block.id), String(block.name));
        if (block.type === "tool_result") {
          const name = idToName.get(String(block.tool_use_id));
          if (name) {
            try {
              results.set(name, JSON.parse(String(block.content)));
            } catch {
              results.set(name, block.content);
            }
          }
        }
      }
    }
    let text: string;
    try {
      text = script.narrate(results, question);
    } catch (err) {
      text = `(Mock mode) I couldn't template a narration from the tool results (${String(err)}). The tool calls themselves succeeded — check the inline artifacts above.`;
    }
    return { stop_reason: "end_turn", content: [{ type: "text", text }] };
  }
}

function extractUserText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const blocks = content as AgentBlock[];
    if (blocks.some((b) => b.type === "tool_result")) return null;
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return text.length > 0 ? text : null;
  }
  return null;
}

// ---------------------------------------------------------------------------

export const USE_MOCK = process.env.USE_MOCK_LLM === "true";

export function createChatModel(): ChatModel {
  return USE_MOCK ? new MockChatModel() : new RealChatModel();
}

/** Canned analysis for /api/reason in mock mode — same schema as the real call. */
export function mockAnalysis(summary: any) {
  const anomaly = summary.anomalies?.[0];
  const under = summary.commitments?.find((c: any) => c.status === "underutilized");
  return {
    finding: anomaly
      ? `${anomaly.slice} spend is running ${anomaly.peak_ratio}x its trailing baseline (a ${anomaly.type === "cost_mix" ? "cost-mix" : "volume"} anomaly) while the blended total stays under budget.`
      : "Spend is within budget and no per-slice anomaly is firing.",
    explanation: anomaly
      ? `Peak day cost ${anomaly.peak_cost} vs baseline ${anomaly.baseline}; cumulative excess ${anomaly.cumulative_excess}. Cost per event rose ${anomaly.cost_per_event_ratio}x, so the spend mix shifted toward expensive units. The blended total ${anomaly.visible_at_invoice_level ? "also flagged it" : "did not flag it — it is invisible at the invoice level"}.`
      : `Projected ${summary.forecast?.projected_window_total} vs budget ${summary.forecast?.budget}.`,
    recommendations: [
      ...(anomaly
        ? [{
            title: `Re-route ${anomaly.drivers?.find((d: any) => d.dimension === "feature")?.slice ?? "the affected feature"} to the cheaper model`,
            action: "Route routine calls to the cheapest capable model; reserve the frontier model for escalations.",
            rationale: `The anomaly's cumulative excess is ${anomaly.cumulative_excess} over ${anomaly.start_day}–${anomaly.end_day}; unit economics (cost/event ${anomaly.cost_per_event_ratio}x) show mix shift, not volume. (Mock mode: use get_routing_economics for the exact savings figure.)`,
            estimated_monthly_savings_usd: 0,
            pricing_model: "per_token",
            priority: 1,
          }]
        : []),
      ...(under
        ? [{
            title: `Right-size the ${under.provider}/${under.feature} commitment`,
            action: `Utilization is ${(under.utilization * 100).toFixed(0)}% of ${under.included_quantity} ${under.unit}; reduce the committed tier at renewal.`,
            rationale: `You pay ${under.committed_cost}/mo regardless of usage; at current utilization the unused share is ${(under.committed_cost * (1 - under.utilization)).toFixed(0)}/mo of shelf-ware.`,
            estimated_monthly_savings_usd: Math.round(under.committed_cost * (1 - under.utilization)),
            pricing_model: "committed",
            priority: 2,
          }]
        : []),
    ],
  };
}
