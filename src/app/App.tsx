// Dashboard (SPEC.md §5 screen 1): spend, attribution, forecast vs budget.
// The "as of day" scrubber re-runs metering + attribution + forecast on the
// events up to that day, so every number is honest for that point in time.

import { useEffect, useMemo, useState } from "react";
import { detectAnomalies } from "../anomaly";
import { attribute } from "../attribution";
import { forecast } from "../forecast";
import { meterEvents } from "../meter";
import type { GeneratorConfig, UsageEvent } from "../schema";
import { buildWindowSummary } from "../summarize";
import { AlertCards } from "./AlertCard";
import { Breakdowns } from "./Breakdowns";
import { Commitments } from "./Commitments";
import { MONTHLY_BUDGET } from "./config";
import { DailyCharts } from "./DailyCharts";
import { ForecastCard } from "./ForecastCard";
import { ReasoningPanel } from "./ReasoningPanel";
import { usd, usd2 } from "./format";

interface DataFile {
  generated_at: string;
  config: GeneratorConfig;
  events: UsageEvent[];
}

export function App() {
  const [data, setData] = useState<DataFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOfIndex, setAsOfIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/usage-events.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const allDays = useMemo(
    () => (data ? [...new Set(data.events.map((e) => e.timestamp.slice(0, 10)))].sort() : []),
    [data],
  );

  // Default the scrubber to the last day with data.
  const dayIndex = asOfIndex ?? allDays.length - 1;
  const asOfDay = allDays[dayIndex] ?? "";

  const view = useMemo(() => {
    if (!data || !asOfDay) return null;
    const eventsToDate = data.events.filter((e) => e.timestamp.slice(0, 10) <= asOfDay);
    const metered = meterEvents(eventsToDate, data.config.commitments ?? []);
    const attributed = attribute(metered.events);
    const fc = forecast(
      metered.events,
      metered.commitments,
      data.config.commitments ?? [],
      allDays,
      asOfDay,
      MONTHLY_BUDGET,
    );
    // Detection sees only elapsed days, so the scrubber replays alerts
    // exactly as they would have unfolded (no lookahead).
    const alerts = detectAnomalies(metered.events, allDays.slice(0, allDays.indexOf(asOfDay) + 1));
    const summary = buildWindowSummary(data.config, metered, attributed, fc, alerts);
    return { metered, attributed, fc, alerts, summary };
  }, [data, asOfDay, allDays]);

  if (error) return <div className="load-state">Failed to load usage data: {error}</div>;
  if (!data || !view) return <div className="load-state">Loading usage events…</div>;

  const { metered, attributed, fc, alerts, summary } = view;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>AI Spend Governor</h1>
          <span className="subtitle">
            preset: {data.config.preset} · {data.config.customer_id} / {data.config.team_id} ·{" "}
            {allDays.length}-day window
          </span>
        </div>
        <label className="scrubber">
          <span>
            as of <strong>{asOfDay}</strong> (day {fc.daysElapsed} of {fc.daysTotal})
          </span>
          <input
            type="range"
            min={0}
            max={allDays.length - 1}
            value={dayIndex}
            onChange={(e) => setAsOfIndex(Number(e.target.value))}
          />
        </label>
      </header>

      <section className="kpis">
        <div className="kpi">
          <span className="kpi-label">Spend to date</span>
          <span className="kpi-value">{usd2(fc.spendToDate)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Projected month-end</span>
          <span className={`kpi-value status-${fc.status}`}>{usd2(fc.projectedTotal)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Budget</span>
          <span className="kpi-value">{usd(fc.budget)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Variable burn / day</span>
          <span className="kpi-value">{usd2(fc.variableDailyBurn)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Events metered</span>
          <span className="kpi-value">{metered.events.length.toLocaleString()}</span>
        </div>
      </section>

      <AlertCards alerts={alerts} />
      <ReasoningPanel summary={summary} />
      <ForecastCard fc={fc} />
      <DailyCharts events={metered.events} asOfDay={asOfDay} />
      <Commitments commitments={metered.commitments} />
      <Breakdowns attributed={attributed} />
    </div>
  );
}
