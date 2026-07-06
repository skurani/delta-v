// Anomaly detection (SPEC.md §4 "catches runaway/inefficient usage"). Math
// only — no LLM, nothing black-box. Every alert can state plainly why it
// fired.
//
// Design constraints (Week 2 decisions):
// - Detect on PER-SLICE daily series (by resource_type, model, feature),
//   never the blended daily total: fixed fees mute a 3x LLM spike to a
//   ~15% blip at the invoice level. Each alert carries an "invoice-level
//   check" showing whether the blended total would have fired (it usually
//   wouldn't — that contrast is the product story).
// - Baseline = MEDIAN of the trailing window, not the mean: a mean absorbs
//   the anomaly's own first day and talks the detector out of a sustained
//   incident; the median holds for up to ~half the window.
// - Dual threshold: ratio (signal) AND absolute excess floor (materiality),
//   so a $0.20 → $0.60 wiggle in a tiny slice can't page anyone.
// - Consecutive firing days collapse into one episode; model/feature
//   episodes that overlap a resource_type episode attach to it as drivers,
//   so one root cause yields one alert, not six.
// - Alerts are typed by unit economics at the peak: if cost-per-event rose
//   materially, the spend MIX shifted (cost_mix); if cost-per-event held
//   flat, usage simply grew (volume). Same detector, two distinct signals.
// - No lookahead: a day is judged only against days before it, so the
//   as-of-day scrubber replays detection exactly as it would have unfolded.
//
// Thresholds are generic defensible defaults, NOT tuned to the demo data.

import type { RatedEvent } from "./meter";

export const TRAILING_DAYS = 14; // baseline window
export const MIN_HISTORY_DAYS = 7; // no alerts until this much history exists
export const RATIO_THRESHOLD = 1.8; // day must be ≥ 1.8x the trailing median
export const EXCESS_FLOOR_USD = 1.0; // ...and ≥ $1/day over it (materiality)
export const MIX_THRESHOLD = 1.3; // cost-per-event ratio separating mix from volume

export type SliceDimension = "resource_type" | "model" | "feature";
export type AlertType = "cost_mix" | "volume";

export interface Episode {
  dimension: SliceDimension;
  slice: string;
  startDay: string;
  endDay: string;
  ongoing: boolean; // still firing on the last day observed
  peakDay: string;
  peakCost: number;
  peakBaseline: number; // trailing median the peak was judged against
  peakRatio: number;
  cumulativeExcess: number; // Σ (cost − baseline) over firing days
  peakCostPerEvent: number;
  baselineCostPerEvent: number;
  unitEconRatio: number; // peakCostPerEvent / baselineCostPerEvent
}

export interface AnomalyAlert {
  type: AlertType;
  episode: Episode; // the resource_type episode (headline)
  drivers: Episode[]; // overlapping model/feature episodes in the same resource
  invoiceCheck: {
    peakDayTotal: number;
    totalBaseline: number;
    totalRatio: number;
    wouldHaveFired: boolean; // did the blended total clear the same thresholds?
  };
}

interface DayStat {
  cost: number;
  count: number;
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Dense per-day {cost, count} series for one slice, zero-filled over allDays. */
function buildSeries(
  events: RatedEvent[],
  allDays: string[],
  keyOf: (e: RatedEvent) => string | null,
): Map<string, DayStat[]> {
  const dayIndex = new Map(allDays.map((d, i) => [d, i]));
  const out = new Map<string, DayStat[]>();
  for (const e of events) {
    const key = keyOf(e);
    if (key === null) continue;
    const i = dayIndex.get(e.timestamp.slice(0, 10));
    if (i === undefined) continue;
    let series = out.get(key);
    if (!series) {
      series = allDays.map(() => ({ cost: 0, count: 0 }));
      out.set(key, series);
    }
    series[i].cost += e.rated_cost;
    series[i].count += 1;
  }
  return out;
}

/** Trailing-median cost baseline for day i (days [i-TRAILING_DAYS, i), no lookahead). */
function baselineAt(series: DayStat[], i: number): number {
  return median(series.slice(Math.max(0, i - TRAILING_DAYS), i).map((d) => d.cost));
}

/** Trailing-median cost-per-event, over trailing days that had any events. */
function baselineCostPerEventAt(series: DayStat[], i: number): number {
  const window = series.slice(Math.max(0, i - TRAILING_DAYS), i).filter((d) => d.count > 0);
  return median(window.map((d) => d.cost / d.count));
}

function detectEpisodes(
  dimension: SliceDimension,
  seriesBySlice: Map<string, DayStat[]>,
  allDays: string[],
): Episode[] {
  const episodes: Episode[] = [];
  for (const [slice, series] of seriesBySlice) {
    let firing: number[] = [];
    const flush = () => {
      if (firing.length === 0) return;
      const peakIdx = firing.reduce((a, b) =>
        series[b].cost - baselineAt(series, b) > series[a].cost - baselineAt(series, a) ? b : a,
      );
      const peak = series[peakIdx];
      const peakBaseline = baselineAt(series, peakIdx);
      const baselineCpe = baselineCostPerEventAt(series, peakIdx);
      const peakCpe = peak.count > 0 ? peak.cost / peak.count : 0;
      episodes.push({
        dimension,
        slice,
        startDay: allDays[firing[0]],
        endDay: allDays[firing[firing.length - 1]],
        ongoing: firing[firing.length - 1] === allDays.length - 1,
        peakDay: allDays[peakIdx],
        peakCost: round2(peak.cost),
        peakBaseline: round2(peakBaseline),
        peakRatio: peakBaseline > 0 ? Math.round((peak.cost / peakBaseline) * 10) / 10 : 0,
        cumulativeExcess: round2(
          firing.reduce((a, i) => a + (series[i].cost - baselineAt(series, i)), 0),
        ),
        peakCostPerEvent: peakCpe,
        baselineCostPerEvent: baselineCpe,
        unitEconRatio: baselineCpe > 0 ? Math.round((peakCpe / baselineCpe) * 10) / 10 : 0,
      });
      firing = [];
    };

    for (let i = MIN_HISTORY_DAYS; i < series.length; i++) {
      const baseline = baselineAt(series, i);
      const cost = series[i].cost;
      const fires =
        baseline > 0 && cost >= baseline * RATIO_THRESHOLD && cost - baseline >= EXCESS_FLOOR_USD;
      if (fires) {
        if (firing.length > 0 && firing[firing.length - 1] !== i - 1) flush();
        firing.push(i);
      } else if (firing.length > 0) {
        flush();
      }
    }
    flush();
  }
  return episodes;
}

const overlaps = (a: Episode, b: Episode) => a.startDay <= b.endDay && b.startDay <= a.endDay;

export function detectAnomalies(events: RatedEvent[], allDays: string[]): AnomalyAlert[] {
  const byResource = buildSeries(events, allDays, (e) => e.resource_type);
  const byModel = buildSeries(events, allDays, (e) => e.model);
  const byFeature = buildSeries(events, allDays, (e) => e.feature);

  const primaries = detectEpisodes("resource_type", byResource, allDays);
  const subEpisodes = [
    ...detectEpisodes("model", byModel, allDays),
    ...detectEpisodes("feature", byFeature, allDays),
  ];

  // Map every model/feature slice to the resource_type that carries most of
  // its cost, so driver episodes attach to the right headline alert.
  const dominantResource = new Map<string, string>();
  {
    const costs = new Map<string, Map<string, number>>();
    for (const e of events) {
      for (const key of [e.model, e.feature]) {
        if (key === null) continue;
        const perResource = costs.get(key) ?? new Map<string, number>();
        perResource.set(e.resource_type, (perResource.get(e.resource_type) ?? 0) + e.rated_cost);
        costs.set(key, perResource);
      }
    }
    for (const [key, perResource] of costs) {
      dominantResource.set(key, [...perResource.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }
  }

  // Blended-total series for the invoice-level contrast check.
  const totalSeries = allDays.map(() => ({ cost: 0, count: 0 }));
  for (const e of events) {
    const i = allDays.indexOf(e.timestamp.slice(0, 10));
    if (i >= 0) totalSeries[i].cost += e.rated_cost;
  }

  const alerts: AnomalyAlert[] = primaries.map((episode) => {
    const drivers = subEpisodes
      .filter((s) => dominantResource.get(s.slice) === episode.slice && overlaps(s, episode))
      .sort((a, b) => b.cumulativeExcess - a.cumulativeExcess);

    const peakIdx = allDays.indexOf(episode.peakDay);
    const totalBaseline = baselineAt(totalSeries, peakIdx);
    const peakDayTotal = totalSeries[peakIdx].cost;
    const totalRatio = totalBaseline > 0 ? peakDayTotal / totalBaseline : 0;

    return {
      type: episode.unitEconRatio >= MIX_THRESHOLD ? ("cost_mix" as const) : ("volume" as const),
      episode,
      drivers,
      invoiceCheck: {
        peakDayTotal: round2(peakDayTotal),
        totalBaseline: round2(totalBaseline),
        totalRatio: Math.round(totalRatio * 100) / 100,
        wouldHaveFired:
          totalBaseline > 0 &&
          peakDayTotal >= totalBaseline * RATIO_THRESHOLD &&
          peakDayTotal - totalBaseline >= EXCESS_FLOOR_USD,
      },
    };
  });

  return alerts.sort((a, b) => b.episode.cumulativeExcess - a.episode.cumulativeExcess);
}
