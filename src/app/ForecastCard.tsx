// Forecast vs budget chart (Stage 2b refinements per the handoff):
//   actual   — cumulative rated spend, solid #F2F2F2 2px, up to today
//   forecast — dashed #8A8A8A 1.5px from today to the projected window
//              total; the portion past the budget crossing renders as
//              dashed signal/negative
//   budget   — solid 1.5px grey rule
//   today    — dot at the actual/forecast junction
//
// The forecast segment is a straight visualization of the engine's existing
// projection (spend-to-date → fc.projectedTotal) — no new math. With the
// honest defaults the projection never crosses the budget in this dataset;
// the negative branch exists and is verified against a synthetic
// over-budget forecast, NOT by tuning the data.

import {
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Rollup } from "../attribution";
import type { ForecastResult } from "../forecast";
import { shortDay, usd, usd2 } from "./format";
import { CHART_TICK, CHART_TOOLTIP } from "./SeriesChart";

export interface ForecastPoint {
  day: string;
  actual: number | null;
  forecast: number | null; // grey segment (shares the crossing point with forecastOver)
  forecastOver: number | null; // negative segment from the budget crossing onward
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Builds the chart series: cumulative actuals over elapsed days, then a
 * linear projection to fc.projectedTotal at window end, split into grey /
 * negative segments where it crosses the budget. Pure — unit-checkable
 * with a synthetic over-budget forecast.
 */
export function buildForecastSeries(
  allDays: string[],
  byDay: Record<string, Rollup>,
  fc: ForecastResult,
): ForecastPoint[] {
  const elapsedIdx = allDays.indexOf(fc.asOfDay);
  const points: ForecastPoint[] = [];

  // Cumulative actuals up to and including today.
  let cum = 0;
  for (let i = 0; i <= elapsedIdx; i++) {
    cum += byDay[allDays[i]]?.cost ?? 0;
    points.push({ day: allDays[i], actual: round2(cum), forecast: null, forecastOver: null });
  }
  const cumEnd = round2(cum);

  const lastIdx = allDays.length - 1;
  const remaining = lastIdx - elapsedIdx;
  if (remaining <= 0) {
    // Window complete — nothing left to project.
    return points;
  }

  // Linear projection from today's cumulative to the projected total.
  const v = (i: number) => round2(cumEnd + ((fc.projectedTotal - cumEnd) * (i - elapsedIdx)) / remaining);

  // First projected index at/past the budget (only meaningful when the
  // projection is heading over from under).
  let crossing = -1;
  if (cumEnd < fc.budget) {
    for (let i = elapsedIdx + 1; i <= lastIdx; i++) {
      if (v(i) >= fc.budget) {
        crossing = i;
        break;
      }
    }
  } else {
    crossing = elapsedIdx; // already over budget — the whole projection is negative
  }

  // Today's point anchors the forecast to the actual line.
  points[elapsedIdx].forecast = cumEnd;
  if (crossing === elapsedIdx) points[elapsedIdx].forecastOver = cumEnd;

  for (let i = elapsedIdx + 1; i <= lastIdx; i++) {
    const value = v(i);
    points.push({
      day: allDays[i],
      actual: null,
      // Grey up to (and including) the crossing point so the segments join;
      // negative from the crossing onward.
      forecast: crossing === -1 || i <= crossing ? value : null,
      forecastOver: crossing !== -1 && i >= crossing ? value : null,
    });
  }
  return points;
}

export function ForecastCard({
  fc,
  byDay,
  allDays,
}: {
  fc: ForecastResult;
  byDay: Record<string, Rollup>;
  allDays: string[];
}) {
  const data = buildForecastSeries(allDays, byDay, fc).map((p) => ({ ...p, day: shortDay(p.day) }));
  const yMax = Math.ceil(Math.max(fc.budget, fc.projectedTotal) * 1.08);
  const todayPoint = data[allDays.indexOf(fc.asOfDay)];

  return (
    <div className="forecast-chart">
      <div className="forecast-status">
        <span className={`status-${fc.status}`}>
          projected {usd2(fc.projectedTotal)} vs {usd(fc.budget)} budget (
          {fc.variance > 0 ? "+" : ""}
          {usd2(fc.variance)})
        </span>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 8, right: 10, left: 8, bottom: 0 }}>
          <XAxis dataKey="day" tick={CHART_TICK} interval="preserveStartEnd" />
          <YAxis tick={CHART_TICK} width={50} domain={[0, yMax]} />
          <Tooltip
            formatter={(value, name) => [
              usd2(Number(value ?? 0)),
              name === "actual" ? "actual" : name === "forecastOver" ? "forecast (over budget)" : "forecast",
            ]}
            contentStyle={CHART_TOOLTIP}
          />
          <ReferenceLine
            y={fc.budget}
            stroke="#484848"
            strokeWidth={1.5}
            label={{
              value: "budget",
              position: "insideTopRight",
              fill: "#787878",
              fontSize: 10,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          />
          <Line type="monotone" dataKey="actual" stroke="#F2F2F2" strokeWidth={2} dot={false} />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#8A8A8A"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="forecastOver"
            stroke="#F2968C"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
          {todayPoint && todayPoint.actual !== null && (
            <ReferenceDot x={todayPoint.day} y={todayPoint.actual} r={3.5} fill="#F2F2F2" stroke="none" />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="fine-print">
        Projection = fixed {usd2(fc.projectedFixed)} + variable {usd2(fc.projectedVariable)}
        {fc.projectedOverage > 0 ? ` + projected overage ${usd2(fc.projectedOverage)}` : ""} · variable
        burn {usd2(fc.variableDailyBurn)}/day (trailing 7-day avg)
      </p>
    </div>
  );
}
