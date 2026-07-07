// Routing economics (engine math — no LLM). Computes, for one feature, what
// its LLM spend looks like per model and what it would cost if every call
// routed to the cheapest model observed on that feature. This exists so the
// agent's "rerouting saves ~$X/mo" is a COMPUTED number, never a model guess
// — the no-re-derivation rule at the exact spot it's most tempting to break.

import type { RatedEvent } from "./meter";

export interface ModelEconomics {
  model: string;
  provider: string;
  events: number;
  total_tokens: number;
  avg_tokens_per_call: number;
  unit_cost_per_token: number;
  cost: number;
  share_of_feature_cost: number;
}

export interface RoutingEconomics {
  feature: string;
  days_elapsed: number;
  models: ModelEconomics[];
  cheapest_model: string;
  current_window_cost: number;
  window_cost_if_all_cheapest: number; // same token volume, cheapest observed rate
  window_savings: number;
  estimated_monthly_savings: number; // window savings scaled to 30 days
  note: string;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function routingEconomics(
  events: RatedEvent[],
  feature: string,
  daysElapsed: number,
): RoutingEconomics | { error: string } {
  const llm = events.filter(
    (e) => e.feature === feature && e.resource_type === "llm" && e.model !== null,
  );
  if (llm.length === 0) return { error: `no LLM events for feature "${feature}"` };

  const byModel = new Map<string, { provider: string; events: number; tokens: number; cost: number; unitCost: number }>();
  for (const e of llm) {
    const m = byModel.get(e.model!) ?? {
      provider: e.provider,
      events: 0,
      tokens: 0,
      cost: 0,
      unitCost: e.unit_cost,
    };
    m.events += 1;
    m.tokens += e.quantity;
    m.cost += e.rated_cost;
    byModel.set(e.model!, m);
  }

  const totalCost = [...byModel.values()].reduce((a, m) => a + m.cost, 0);
  const totalTokens = [...byModel.values()].reduce((a, m) => a + m.tokens, 0);
  const models: ModelEconomics[] = [...byModel.entries()]
    .map(([model, m]) => ({
      model,
      provider: m.provider,
      events: m.events,
      total_tokens: m.tokens,
      avg_tokens_per_call: Math.round(m.tokens / m.events),
      unit_cost_per_token: m.unitCost,
      cost: round2(m.cost),
      share_of_feature_cost: totalCost > 0 ? Math.round((m.cost / totalCost) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const cheapest = models.reduce((a, b) => (b.unit_cost_per_token < a.unit_cost_per_token ? b : a));
  const counterfactual = totalTokens * cheapest.unit_cost_per_token;
  const windowSavings = totalCost - counterfactual;

  return {
    feature,
    days_elapsed: daysElapsed,
    models,
    cheapest_model: cheapest.model,
    current_window_cost: round2(totalCost),
    window_cost_if_all_cheapest: round2(counterfactual),
    window_savings: round2(windowSavings),
    estimated_monthly_savings: round2(daysElapsed > 0 ? (windowSavings / daysElapsed) * 30 : 0),
    note: "Counterfactual assumes identical token volume at the cheapest observed per-token rate; it ignores quality differences between models — routing hard cases to a cheap model may not be acceptable.",
  };
}
