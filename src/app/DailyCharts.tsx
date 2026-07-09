// Daily spend charts. Two views on purpose:
//  1. Total daily spend stacked by resource type — the executive picture.
//     Fixed costs dominate, so a 3x LLM spike barely moves this chart.
//  2. LLM-only daily spend — where model-routing anomalies are actually
//     visible.

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RatedEvent } from "../meter";
import type { ResourceType } from "../schema";
import { shortDay, usd2 } from "./format";

// Delta-V system: series colors are a neutral gray ramp — signal colors
// are semantic-only. The one sanctioned exception below: detector-flagged
// anomalous days take signal/negative fill + axis label (spec §04), which
// IS a semantic claim, not decoration.
const RESOURCE_ORDER: ResourceType[] = ["api", "subscription", "compute", "llm"];
const RESOURCE_COLOR: Record<ResourceType, string> = {
  api: "#8A8A8A",
  subscription: "#3E3E3E",
  compute: "#5E5E5E",
  llm: "#F2F2F2",
};
const NEG = "#F2968C";

const TICK_STYLE = { fontSize: 11, fill: "#787878", fontFamily: "'IBM Plex Mono', monospace" };

/** X-axis tick that flips to signal/negative on detector-flagged days. */
function anomalyTick(anomalous: Set<string>) {
  return function AnomalyTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
    const day = String(props.payload?.value ?? "");
    return (
      <text
        x={props.x}
        y={(props.y ?? 0) + 10}
        textAnchor="middle"
        fontSize={11}
        fontFamily="'IBM Plex Mono', monospace"
        fill={anomalous.has(day) ? NEG : "#787878"}
      >
        {day}
      </text>
    );
  };
}

export function DailyCharts({
  events,
  asOfDay,
  anomalousDays,
}: {
  events: RatedEvent[];
  asOfDay: string;
  anomalousDays: Set<string>; // ISO days flagged by the anomaly detector
}) {
  const rows = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    for (const e of events) {
      const day = e.timestamp.slice(0, 10);
      const row = byDay.get(day) ?? {};
      row[e.resource_type] = (row[e.resource_type] ?? 0) + e.rated_cost;
      byDay.set(day, row);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, r]) => ({
        day: shortDay(day),
        anomalous: anomalousDays.has(day),
        ...Object.fromEntries(RESOURCE_ORDER.map((t) => [t, Math.round((r[t] ?? 0) * 100) / 100])),
      }));
  }, [events, anomalousDays]);

  const anomalousShort = useMemo(
    () => new Set(rows.filter((r) => r.anomalous).map((r) => r.day)),
    [rows],
  );
  const Tick = useMemo(() => anomalyTick(anomalousShort), [anomalousShort]);

  const tooltip = (
    <Tooltip
      formatter={(value, name) => [usd2(Number(value ?? 0)), String(name)]}
      contentStyle={{
        background: "#191919",
        border: "1px solid #2E2E2E",
        borderRadius: 6,
        fontSize: 13,
        fontFamily: "'IBM Plex Mono', monospace",
        color: "#F2F2F2",
      }}
    />
  );

  return (
    <section className="card">
      <div className="card-head">
        <h2>Daily spend</h2>
        <span className="subtitle">through {asOfDay}</span>
      </div>
      <div className="charts-row">
        <div className="chart-box">
          <h3>Total by resource type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="day" tick={<Tick />} interval="preserveStartEnd" />
              <YAxis tick={TICK_STYLE} width={52} />
              {tooltip}
              {RESOURCE_ORDER.map((t) => (
                <Bar key={t} dataKey={t} stackId="cost" fill={RESOURCE_COLOR[t]}>
                  {/* Anomalous days: the LLM segment (the flagged slice) takes
                      signal/negative — the semantic exception, per spec. */}
                  {t === "llm" &&
                    rows.map((r) => (
                      <Cell key={r.day} fill={r.anomalous ? NEG : RESOURCE_COLOR.llm} />
                    ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <h3>LLM spend only</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="day" tick={<Tick />} interval="preserveStartEnd" />
              <YAxis tick={TICK_STYLE} width={52} />
              {tooltip}
              <Line
                type="monotone"
                dataKey="llm"
                stroke={RESOURCE_COLOR.llm}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="fine-print">
        Fixed costs dominate the total, so model-routing problems hide in the left chart — the
        LLM-only view is where they show.
      </p>
    </section>
  );
}
