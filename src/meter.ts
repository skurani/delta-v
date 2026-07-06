// Metering / rating engine (SPEC.md §4a). Math only — no LLM.
//
// Rates each raw UsageEvent to what it actually costs the customer:
//   per_token / per_call → quantity × unit_cost
//   committed            → consumption tracked against the CommitmentTier;
//                          window cost = committed fee + overage. The fee is
//                          allocated back across the tier's events pro rata to
//                          quantity, so attribution rollups sum to the truth.
//   flat                 → fixed fee, taken as-is
//
// POC simplification: the generated window (~30 days) is treated as one
// commitment period rather than splitting on calendar-month boundaries.

import type { CommitmentTier, UsageEvent } from "./schema";

export interface RatedEvent extends UsageEvent {
  rated_cost: number;
}

export interface CommitmentStatus {
  provider: string;
  feature: string;
  unit: string;
  usedQuantity: number;
  includedQuantity: number;
  utilization: number; // usedQuantity / includedQuantity
  committedCost: number;
  overageQuantity: number;
  overageCost: number;
  ratedCost: number; // committedCost + overageCost
  status: "underutilized" | "on_track" | "overage";
}

export interface MeterResult {
  events: RatedEvent[];
  commitments: CommitmentStatus[];
  totals: {
    rawCost: number; // naive sum of event.cost as emitted
    ratedCost: number; // what the window actually costs after rating
  };
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const tierKey = (provider: string, feature: string) => `${provider}::${feature}`;

export function meterEvents(events: UsageEvent[], commitments: CommitmentTier[]): MeterResult {
  const tiers = new Map(commitments.map((c) => [tierKey(c.provider, c.feature), c]));

  // Pass 1: total consumption per commitment tier.
  const usedByTier = new Map<string, number>();
  for (const e of events) {
    if (e.pricing_model !== "committed") continue;
    const key = tierKey(e.provider, e.feature);
    if (!tiers.has(key)) continue; // no contract on file → falls through to usage-rating below
    usedByTier.set(key, (usedByTier.get(key) ?? 0) + e.quantity);
  }

  // Rate each tier for the window.
  const statusByTier = new Map<string, CommitmentStatus>();
  for (const [key, tier] of tiers) {
    const used = usedByTier.get(key) ?? 0;
    const overageQuantity = Math.max(0, used - tier.includedQuantityPerMonth);
    const overageCost = round6(overageQuantity * tier.overageRate);
    const utilization = used / tier.includedQuantityPerMonth;
    statusByTier.set(key, {
      provider: tier.provider,
      feature: tier.feature,
      unit: tier.unit,
      usedQuantity: round6(used),
      includedQuantity: tier.includedQuantityPerMonth,
      utilization: round6(utilization),
      committedCost: tier.committedCostPerMonth,
      overageQuantity: round6(overageQuantity),
      overageCost,
      ratedCost: round6(tier.committedCostPerMonth + overageCost),
      status: overageQuantity > 0 ? "overage" : utilization < 0.7 ? "underutilized" : "on_track",
    });
  }

  // Pass 2: rate every event.
  const rated: RatedEvent[] = events.map((e) => {
    switch (e.pricing_model) {
      case "per_token":
      case "per_call":
        return { ...e, rated_cost: round6(e.quantity * e.unit_cost) };
      case "flat":
        return { ...e, rated_cost: round6(e.quantity * e.unit_cost) };
      case "committed": {
        const key = tierKey(e.provider, e.feature);
        const status = statusByTier.get(key);
        if (!status) return { ...e, rated_cost: round6(e.quantity * e.unit_cost) };
        // Allocate the tier's rated window cost pro rata to this event's
        // share of consumption (TBM-style allocation).
        const share = status.usedQuantity > 0 ? e.quantity / status.usedQuantity : 0;
        return { ...e, rated_cost: round6(status.ratedCost * share) };
      }
    }
  });

  return {
    events: rated,
    commitments: [...statusByTier.values()],
    totals: {
      rawCost: round6(events.reduce((a, e) => a + e.cost, 0)),
      ratedCost: round6(rated.reduce((a, e) => a + e.rated_cost, 0)),
    },
  };
}
