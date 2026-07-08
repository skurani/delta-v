// Small per-day cost line chart, used by chat artifacts and pinned cards.
// Neutral series color — signal colors are semantic-only in the Delta-V system.

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDay, usd2 } from "./format";

export interface SeriesResult {
  slice_by: string;
  key: string;
  series: { day: string; cost: number }[];
}

export const CHART_GRID = "#2E2E2E";
export const CHART_TICK = { fontSize: 11, fill: "#787878", fontFamily: "'IBM Plex Mono', monospace" };
export const CHART_TOOLTIP = {
  background: "#191919",
  border: "1px solid #2E2E2E",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "'IBM Plex Mono', monospace",
  color: "#F2F2F2",
};

export function SeriesChart({ result, height = 150 }: { result: SeriesResult; height?: number }) {
  const data = result.series.map((p) => ({ ...p, day: shortDay(p.day) }));
  return (
    <div className="series-chart">
      <h3 className="mono-label">daily cost — {result.key}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="day" tick={CHART_TICK} interval="preserveStartEnd" />
          <YAxis tick={CHART_TICK} width={46} />
          <Tooltip
            formatter={(value) => [usd2(Number(value ?? 0)), "cost"]}
            contentStyle={CHART_TOOLTIP}
          />
          <Line type="monotone" dataKey="cost" stroke="#F2F2F2" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
