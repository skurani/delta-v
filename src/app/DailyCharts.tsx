// Daily spend charts. Two views on purpose:
//  1. Total daily spend stacked by resource type — the executive picture.
//     Fixed costs dominate, so a 3x LLM spike barely moves this chart.
//  2. LLM-only daily spend — where model-routing anomalies are actually
//     visible. This is the chart the Week-2 anomaly card will point at.

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

const RESOURCE_ORDER: ResourceType[] = ["api", "subscription", "compute", "llm"];
const RESOURCE_COLOR: Record<ResourceType, string> = {
  api: "#5b7db1",
  subscription: "#8a86b8",
  compute: "#6aa284",
  llm: "#d98943",
};

export function DailyCharts({ events, asOfDay }: { events: RatedEvent[]; asOfDay: string }) {
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
        ...Object.fromEntries(RESOURCE_ORDER.map((t) => [t, Math.round((r[t] ?? 0) * 100) / 100])),
      }));
  }, [events]);

  const tooltip = (
    <Tooltip
      formatter={(value, name) => [usd2(Number(value ?? 0)), String(name)]}
      contentStyle={{ background: "#1b2130", border: "1px solid #2e3950", borderRadius: 6 }}
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
              <CartesianGrid stroke="#242d40" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={52} />
              {tooltip}
              {RESOURCE_ORDER.map((t) => (
                <Bar key={t} dataKey={t} stackId="cost" fill={RESOURCE_COLOR[t]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <h3>LLM spend only</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#242d40" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={52} />
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
