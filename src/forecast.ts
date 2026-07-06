// Forecast vs budget (SPEC.md §4c). Math only — no LLM.
//
// Projects end-of-window spend from an "as of day N" view of the rated
// events. The projection separates spend by how it behaves:
//   flat / committed fees → known for the window regardless of usage
//   committed overage     → project tier usage to window end at the current
//                           daily usage rate, then rate the overage
//   per_token / per_call  → trailing-average daily burn × remaining days
//
// The budget is an input, set independently of the data (see src/app/config.ts).

import type { CommitmentStatus, RatedEvent } from "./meter";
import type { CommitmentTier } from "./schema";

export interface ForecastResult {
  asOfDay: string; // ISO date of the last day included
  daysElapsed: number;
  daysTotal: number;
  spendToDate: number; // variable to date + flat to date + full committed fees + overage to date
  variableDailyBurn: number; // trailing-avg daily per_token/per_call spend
  projectedVariable: number; // variable to date + burn × remaining days
  projectedFixed: number; // flat + committed fees for the window
  projectedOverage: number; // overage if tier usage continues at current rate
  projectedTotal: number;
  budget: number;
  variance: number; // projectedTotal - budget (positive = over)
  status: "under" | "near" | "over";
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const TRAILING_DAYS = 7;

export function forecast(
  eventsToDate: RatedEvent[], // rated events with timestamp <= asOfDay
  commitmentsToDate: CommitmentStatus[], // meter output over the same events
  tiers: CommitmentTier[],
  allDays: string[], // every day in the window, sorted ascending
  asOfDay: string,
  budget: number,
): ForecastResult {
  const daysTotal = allDays.length;
  const daysElapsed = allDays.filter((d) => d <= asOfDay).length;
  const daysRemaining = daysTotal - daysElapsed;

  // Variable spend (per_token / per_call) by day, for burn rate.
  const variableByDay = new Map<string, number>();
  let variableToDate = 0;
  let flatToDate = 0;
  for (const e of eventsToDate) {
    if (e.pricing_model === "per_token" || e.pricing_model === "per_call") {
      variableToDate += e.rated_cost;
      const day = e.timestamp.slice(0, 10);
      variableByDay.set(day, (variableByDay.get(day) ?? 0) + e.rated_cost);
    } else if (e.pricing_model === "flat") {
      flatToDate += e.rated_cost;
    }
  }

  // Trailing-average daily variable burn over the last N elapsed days.
  const elapsedDays = allDays.slice(0, daysElapsed);
  const trailing = elapsedDays.slice(-TRAILING_DAYS);
  const variableDailyBurn =
    trailing.length > 0
      ? trailing.reduce((a, d) => a + (variableByDay.get(d) ?? 0), 0) / trailing.length
      : 0;
  const projectedVariable = variableToDate + variableDailyBurn * daysRemaining;

  // Fixed: committed fees are owed for the window regardless of usage.
  // Flat charges: whatever has landed to date (monthly charges land on day 1).
  const committedFees = tiers.reduce((a, t) => a + t.committedCostPerMonth, 0);
  const projectedFixed = committedFees + flatToDate;

  // Committed overage: project each tier's usage to window end at its
  // current daily rate, then rate anything beyond the included quantity.
  let overageToDate = 0;
  let projectedOverage = 0;
  for (const status of commitmentsToDate) {
    overageToDate += status.overageCost;
    const tier = tiers.find((t) => t.provider === status.provider && t.feature === status.feature);
    if (!tier || daysElapsed === 0) continue;
    const projectedUse = (status.usedQuantity / daysElapsed) * daysTotal;
    const projectedOverQty = Math.max(0, projectedUse - tier.includedQuantityPerMonth);
    projectedOverage += projectedOverQty * tier.overageRate;
  }

  const spendToDate = round2(variableToDate + flatToDate + committedFees + overageToDate);
  const projectedTotal = round2(projectedVariable + projectedFixed + projectedOverage);
  const variance = round2(projectedTotal - budget);

  return {
    asOfDay,
    daysElapsed,
    daysTotal,
    spendToDate,
    variableDailyBurn: round2(variableDailyBurn),
    projectedVariable: round2(projectedVariable),
    projectedFixed: round2(projectedFixed),
    projectedOverage: round2(projectedOverage),
    projectedTotal,
    budget,
    variance,
    status: variance > 0 ? "over" : projectedTotal > budget * 0.95 ? "near" : "under",
  };
}
