// Window summary for the LLM reasoning call (SPEC.md §4d). Math only.
//
// Compresses the full metered/attributed/forecast/anomaly picture into a
// compact JSON context (~1-2KB) so the reasoning step is ONE batched call
// per analysis window, not a conversation over raw events. Everything the
// model sees is a number the dashboard also shows — no hidden context.

import type { AnomalyAlert } from "./anomaly";
import type { AttributionResult, Rollup } from "./attribution";
import { topEntries } from "./attribution";
import type { ForecastResult } from "./forecast";
import type { MeterResult } from "./meter";
import type { GeneratorConfig } from "./schema";

export interface WindowSummary {
  window: {
    preset: string;
    customer_id: string;
    team_id: string;
    window_start: string; // first day with data — so narration never guesses the calendar span
    as_of_day: string;
    days_elapsed: number;
    days_total: number;
  };
  totals: {
    rated_cost_to_date: number;
    events_metered: number;
  };
  forecast: {
    projected_window_total: number;
    budget: number;
    variance: number; // positive = over budget
    status: string;
    variable_daily_burn: number;
    projected_fixed: number;
    projected_overage: number;
  };
  by_resource_type: SliceCost[];
  by_model: SliceCost[];
  by_feature: SliceCost[];
  commitments: {
    provider: string;
    feature: string;
    status: string;
    utilization: number;
    used_quantity: number;
    included_quantity: number;
    unit: string;
    committed_cost: number;
    overage_cost: number;
  }[];
  anomalies: {
    type: string; // cost_mix | volume
    slice: string;
    start_day: string;
    end_day: string;
    ongoing: boolean;
    peak_ratio: number; // vs trailing 14-day median
    peak_cost: number;
    baseline: number;
    cumulative_excess: number;
    cost_per_event_ratio: number;
    drivers: { dimension: string; slice: string; peak_ratio: number; excess: number }[];
    visible_at_invoice_level: boolean;
  }[];
}

interface SliceCost {
  key: string;
  cost: number;
  share: number;
}

const slices = (dim: Record<string, Rollup>, limit = 6): SliceCost[] =>
  topEntries(dim, limit).map(([key, r]) => ({ key, cost: r.cost, share: r.share }));

export function buildWindowSummary(
  config: GeneratorConfig,
  metered: MeterResult,
  attributed: AttributionResult,
  fc: ForecastResult,
  alerts: AnomalyAlert[],
): WindowSummary {
  return {
    window: {
      preset: config.preset,
      customer_id: config.customer_id,
      team_id: config.team_id,
      window_start: Object.keys(attributed.byDay).sort()[0] ?? fc.asOfDay,
      as_of_day: fc.asOfDay,
      days_elapsed: fc.daysElapsed,
      days_total: fc.daysTotal,
    },
    totals: {
      rated_cost_to_date: fc.spendToDate,
      events_metered: metered.events.length,
    },
    forecast: {
      projected_window_total: fc.projectedTotal,
      budget: fc.budget,
      variance: fc.variance,
      status: fc.status,
      variable_daily_burn: fc.variableDailyBurn,
      projected_fixed: fc.projectedFixed,
      projected_overage: fc.projectedOverage,
    },
    by_resource_type: slices(attributed.byResourceType),
    by_model: slices(attributed.byModel),
    by_feature: slices(attributed.byFeature),
    commitments: metered.commitments.map((c) => ({
      provider: c.provider,
      feature: c.feature,
      status: c.status,
      utilization: c.utilization,
      used_quantity: c.usedQuantity,
      included_quantity: c.includedQuantity,
      unit: c.unit,
      committed_cost: c.committedCost,
      overage_cost: c.overageCost,
    })),
    anomalies: alerts.map((a) => ({
      type: a.type,
      slice: a.episode.slice,
      start_day: a.episode.startDay,
      end_day: a.episode.endDay,
      ongoing: a.episode.ongoing,
      peak_ratio: a.episode.peakRatio,
      peak_cost: a.episode.peakCost,
      baseline: a.episode.peakBaseline,
      cumulative_excess: a.episode.cumulativeExcess,
      cost_per_event_ratio: a.episode.unitEconRatio,
      drivers: a.drivers.map((d) => ({
        dimension: d.dimension,
        slice: d.slice,
        peak_ratio: d.peakRatio,
        excess: d.cumulativeExcess,
      })),
      visible_at_invoice_level: a.invoiceCheck.wouldHaveFired,
    })),
  };
}
