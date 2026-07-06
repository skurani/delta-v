// Attribution rollups (SPEC.md §4b). Math only — no LLM.
// Rolls rated costs up by every attribution dimension on the event, powering
// the "whose spend is this / what's it for" views.

import type { RatedEvent } from "./meter";

export interface Rollup {
  cost: number;
  events: number;
  share: number; // fraction of total rated cost
}

export type Dimension =
  | "customer_id"
  | "team_id"
  | "feature"
  | "provider"
  | "model"
  | "resource_type";

export interface AttributionResult {
  totalCost: number;
  byCustomer: Record<string, Rollup>;
  byTeam: Record<string, Rollup>;
  byUser: Record<string, Rollup>; // named seats + "(autonomous)" for user_id: null
  bySeat: Record<"seat_attributed" | "autonomous", Rollup>; // seat-vs-consumption split
  byFeature: Record<string, Rollup>;
  byProvider: Record<string, Rollup>;
  byModel: Record<string, Rollup>;
  byResourceType: Record<string, Rollup>;
  byDay: Record<string, Rollup>; // ISO date → rollup (time series for the dashboard)
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function rollup(events: RatedEvent[], keyOf: (e: RatedEvent) => string): Record<string, Rollup> {
  const out: Record<string, Rollup> = {};
  for (const e of events) {
    const key = keyOf(e);
    const r = (out[key] ??= { cost: 0, events: 0, share: 0 });
    r.cost += e.rated_cost;
    r.events += 1;
  }
  return out;
}

export function attribute(events: RatedEvent[]): AttributionResult {
  const totalCost = events.reduce((a, e) => a + e.rated_cost, 0);

  const result: AttributionResult = {
    totalCost: round2(totalCost),
    byCustomer: rollup(events, (e) => e.customer_id),
    byTeam: rollup(events, (e) => e.team_id),
    byUser: rollup(events, (e) => e.user_id ?? "(autonomous)"),
    bySeat: rollup(events, (e) => (e.user_id ? "seat_attributed" : "autonomous")) as Record<
      "seat_attributed" | "autonomous",
      Rollup
    >,
    byFeature: rollup(events, (e) => e.feature),
    byProvider: rollup(events, (e) => e.provider),
    byModel: rollup(events, (e) => e.model ?? "(no model)"),
    byResourceType: rollup(events, (e) => e.resource_type),
    byDay: rollup(events, (e) => e.timestamp.slice(0, 10)),
  };

  for (const dim of [
    result.byCustomer,
    result.byTeam,
    result.byUser,
    result.bySeat,
    result.byFeature,
    result.byProvider,
    result.byModel,
    result.byResourceType,
    result.byDay,
  ]) {
    for (const r of Object.values(dim)) {
      r.share = totalCost > 0 ? Math.round((r.cost / totalCost) * 1000) / 1000 : 0;
      r.cost = round2(r.cost);
    }
  }

  return result;
}

// Convenience for console/dashboard: entries sorted by cost, descending.
export function topEntries(dim: Record<string, Rollup>, limit = 10): [string, Rollup][] {
  return Object.entries(dim)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, limit);
}
