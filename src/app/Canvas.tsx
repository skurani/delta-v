// Canvas (Stage 2a): single 12-column auto-flow grid of cards. Cards are an
// ordered array — rearrange is a splice, remove is a filter, pin is an
// append. Snap-to-grid is inherent (no free-form x/y, no resize). Column
// spans reproduce the handoff's row proportions.
//
// Pinned cards store the QUERY, not a frozen result: rendering resolves
// {tool, input} against the same memoized engine view the builtin cards use,
// so pins stay live as the as-of scrubber moves and the canvas never
// depends on the server. All layout state is in-memory, session-only.

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AnomalyAlert } from "../anomaly";
import type { AttributionResult, Rollup } from "../attribution";
import { topEntries } from "../attribution";
import { costMatrix } from "../cost-matrix";
import type { ForecastResult } from "../forecast";
import type { MeterResult, RatedEvent } from "../meter";
import type { WindowSummary } from "../summarize";
import { AlertCards } from "./AlertCard";
import { BreakdownCard, Breakdowns } from "./Breakdowns";
import { Commitments } from "./Commitments";
import { DailyCharts } from "./DailyCharts";
import { ForecastCard } from "./ForecastCard";
import { usd, usd2 } from "./format";
import { Heatmap } from "./Heatmap";
import { ReasoningPanel } from "./ReasoningPanel";
import { SeriesChart, type SeriesResult } from "./SeriesChart";

// ---------------------------------------------------------------------------
// Card model
// ---------------------------------------------------------------------------

export type BuiltinComponent =
  | "kpis"
  | "alerts"
  | "daily-charts"
  | "forecast"
  | "commitments"
  | "breakdowns"
  | "reasoning";

export type PinnableTool =
  | "get_daily_series"
  | "get_attribution"
  | "get_anomalies"
  | "get_cost_matrix";

export interface PinQuery {
  tool: PinnableTool;
  input: Record<string, unknown>;
}

export interface Provenance {
  chatQuery: string;
  pinnedAsOf: string;
  pinnedAt: string;
}

export type CanvasCard =
  | { id: string; kind: "builtin"; component: BuiltinComponent }
  | { id: string; kind: "pinned"; query: PinQuery; provenance: Provenance };

export interface EngineView {
  metered: MeterResult;
  attributed: AttributionResult;
  fc: ForecastResult;
  alerts: AnomalyAlert[];
  summary: WindowSummary;
  elapsedDays: string[];
  allDays: string[]; // full window incl. future days — the forecast chart's x-axis
}

// Default order reproduces the handoff rows: KPI row / (alerts) /
// charts row 1fr+380 / bottom row 300+1fr+340 — as 12-col spans.
export const DEFAULT_CARDS: CanvasCard[] = [
  { id: "b-kpis", kind: "builtin", component: "kpis" },
  { id: "b-alerts", kind: "builtin", component: "alerts" },
  { id: "b-daily", kind: "builtin", component: "daily-charts" },
  { id: "b-forecast", kind: "builtin", component: "forecast" },
  { id: "b-commit", kind: "builtin", component: "commitments" },
  { id: "b-breakdowns", kind: "builtin", component: "breakdowns" },
  { id: "b-reasoning", kind: "builtin", component: "reasoning" },
];

const SPAN: Record<BuiltinComponent, number> = {
  kpis: 12,
  alerts: 12,
  "daily-charts": 8,
  forecast: 4,
  commitments: 3,
  breakdowns: 6,
  reasoning: 3,
};

// Pinned cards default to 4 columns; the heatmap needs more room to breathe.
const PINNED_SPAN: Partial<Record<PinnableTool, number>> = { get_cost_matrix: 6 };
const PINNED_SPAN_DEFAULT = 4;

const cardSpan = (card: CanvasCard) =>
  card.kind === "builtin"
    ? SPAN[card.component]
    : PINNED_SPAN[card.query.tool] ?? PINNED_SPAN_DEFAULT;

// ---------------------------------------------------------------------------
// Pinned-query resolution — same engine, client-side, live
// ---------------------------------------------------------------------------

function resolveDailySeries(view: EngineView, input: Record<string, unknown>): SeriesResult {
  const sliceBy = String(input.slice_by ?? "resource_type");
  const key = input.key === undefined ? undefined : String(input.key);
  const match = (e: RatedEvent) =>
    sliceBy === "resource_type" ? e.resource_type === key
    : sliceBy === "model" ? e.model === key
    : sliceBy === "feature" ? e.feature === key
    : true;
  const byDay = new Map<string, number>();
  for (const day of view.elapsedDays) byDay.set(day, 0);
  for (const e of view.metered.events) {
    if (key !== undefined && !match(e)) continue;
    const day = e.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + e.rated_cost);
  }
  return {
    slice_by: sliceBy,
    key: key ?? "(total)",
    series: [...byDay.entries()].map(([day, cost]) => ({ day, cost: Math.round(cost * 100) / 100 })),
  };
}

const DIM_MAP: Record<string, keyof AttributionResult> = {
  resource_type: "byResourceType", provider: "byProvider", model: "byModel",
  feature: "byFeature", team: "byTeam", customer: "byCustomer", user: "byUser", seat: "bySeat", workload: "byWorkload",
};

function PinnedArtifact({ query, view, asOfDay }: { query: PinQuery; view: EngineView; asOfDay: string }) {
  switch (query.tool) {
    case "get_daily_series":
      return <SeriesChart result={resolveDailySeries(view, query.input)} />;
    case "get_cost_matrix":
      // Same shared aggregation the server tool uses — recomputed against
      // the current view, so the pinned heatmap follows the scrubber.
      return (
        <Heatmap matrix={costMatrix(view.metered.events)} events={view.metered.events} asOfDay={asOfDay} />
      );
    case "get_attribution": {
      const dimension = String(query.input.dimension ?? "resource_type");
      const dimKey = DIM_MAP[dimension];
      if (!dimKey) return <p className="mono-label">unknown dimension: {dimension}</p>;
      const dim = view.attributed[dimKey] as Record<string, Rollup>;
      const limited = Object.fromEntries(topEntries(dim, Number(query.input.limit ?? 8)));
      return <BreakdownCard title={`by ${dimension}`} dim={limited} />;
    }
    case "get_anomalies":
      return view.alerts.length > 0 ? (
        <AlertCards alerts={view.alerts} />
      ) : (
        <p className="mono-label">no anomalies firing as of this day</p>
      );
  }
}

// ---------------------------------------------------------------------------
// Builtin card bodies
// ---------------------------------------------------------------------------

// KPI cards per spec §04: eyebrow → value → mono footnote or 3px progress
// bar. Footnotes take signal color only when the state is semantic.
function Kpis({ view }: { view: EngineView }) {
  const { fc } = view;
  const budgetUsed = fc.budget > 0 ? fc.spendToDate / fc.budget : 0;
  return (
    <div className="kpi-grid">
      <div className="kpi">
        <span className="kpi-label">spend to date</span>
        <span className="kpi-value">{usd2(fc.spendToDate)}</span>
        <div className="kpi-bar" title={`${(budgetUsed * 100).toFixed(0)}% of budget`}>
          <div
            className={`kpi-bar-fill ${budgetUsed > 1 ? "kpi-bar-over" : ""}`}
            style={{ width: `${Math.min(100, budgetUsed * 100)}%` }}
          />
        </div>
      </div>
      <div className="kpi">
        <span className="kpi-label">projected month-end</span>
        <span className={`kpi-value status-${fc.status}`}>{usd2(fc.projectedTotal)}</span>
        <span className={`kpi-foot status-${fc.status}`}>
          {usd2(Math.abs(fc.variance))} {fc.variance > 0 ? "over" : "under"} budget
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">budget</span>
        <span className="kpi-value">{usd(fc.budget)}</span>
        <span className="kpi-foot">
          day {fc.daysElapsed}/{fc.daysTotal} · {(budgetUsed * 100).toFixed(0)}% used
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">variable burn / day</span>
        <span className="kpi-value">{usd2(fc.variableDailyBurn)}</span>
        <span className="kpi-foot">trailing 7-day avg</span>
      </div>
    </div>
  );
}

function BuiltinBody({ component, view, asOfDay }: { component: BuiltinComponent; view: EngineView; asOfDay: string }) {
  switch (component) {
    case "kpis":
      return <Kpis view={view} />;
    case "alerts":
      return view.alerts.length > 0 ? (
        <AlertCards alerts={view.alerts} />
      ) : (
        <p className="mono-label">no anomalies firing as of this day</p>
      );
    case "daily-charts": {
      // Detector-flagged days (episode ranges across all alerts) get the
      // semantic negative treatment in the daily bars.
      const anomalousDays = new Set<string>();
      for (const a of view.alerts) {
        for (const d of view.elapsedDays) {
          if (d >= a.episode.startDay && d <= a.episode.endDay) anomalousDays.add(d);
        }
      }
      return <DailyCharts events={view.metered.events} asOfDay={asOfDay} anomalousDays={anomalousDays} />;
    }
    case "forecast":
      return <ForecastCard fc={view.fc} byDay={view.attributed.byDay} allDays={view.allDays} />;
    case "commitments":
      return <Commitments commitments={view.metered.commitments} />;
    case "breakdowns":
      return <Breakdowns attributed={view.attributed} />;
    case "reasoning":
      return <ReasoningPanel summary={view.summary} />;
  }
}

const BUILTIN_TITLE: Record<BuiltinComponent, string> = {
  kpis: "kpis",
  alerts: "anomalies",
  "daily-charts": "daily spend",
  forecast: "forecast vs budget",
  commitments: "commitments",
  breakdowns: "attribution",
  reasoning: "agent reasoning",
};

// ---------------------------------------------------------------------------
// Grid + drag/drop (native HTML5; reorder via handle, pin via chat drag)
// ---------------------------------------------------------------------------

export const PIN_DRAG_MIME = "application/x-deltav-pin";
const REORDER_MIME = "application/x-deltav-reorder";

export function Canvas({
  cards,
  setCards,
  view,
  asOfDay,
}: {
  cards: CanvasCard[];
  setCards: Dispatch<SetStateAction<CanvasCard[]>>;
  view: EngineView;
  asOfDay: string;
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const prevIds = useRef<Set<string> | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // A pinned card that wasn't in the previous render just landed (via PIN
  // button or drag-drop) — bring it into view and flash it once. prevIds
  // starts null so the initial render never flashes.
  useEffect(() => {
    const fresh = prevIds.current
      ? cards.find((c) => c.kind === "pinned" && !prevIds.current!.has(c.id))
      : undefined;
    prevIds.current = new Set(cards.map((c) => c.id));
    if (!fresh) return;
    cellRefs.current.get(fresh.id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setFlashId(fresh.id);
    const t = setTimeout(() => setFlashId(null), 1500);
    return () => clearTimeout(t);
  }, [cards]);

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    setDropIndex(null);
    const reorderId = e.dataTransfer.getData(REORDER_MIME);
    if (reorderId) {
      setCards((cs) => {
        const from = cs.findIndex((c) => c.id === reorderId);
        if (from < 0) return cs;
        const next = [...cs];
        const [moved] = next.splice(from, 1);
        next.splice(from < index ? index - 1 : index, 0, moved);
        return next;
      });
      return;
    }
    const pinJson = e.dataTransfer.getData(PIN_DRAG_MIME);
    if (pinJson) {
      try {
        const { query, provenance } = JSON.parse(pinJson);
        const card: CanvasCard = { id: `pin-${Date.now()}`, kind: "pinned", query, provenance };
        setCards((cs) => [...cs.slice(0, index), card, ...cs.slice(index)]);
      } catch {
        // malformed drag payload — ignore
      }
    }
  }

  const acceptsDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(REORDER_MIME) || e.dataTransfer.types.includes(PIN_DRAG_MIME);

  return (
    <div
      className="canvas"
      onDragOver={(e) => {
        if (acceptsDrag(e)) {
          e.preventDefault();
          setDropIndex(cards.length);
        }
      }}
      onDrop={(e) => handleDrop(e, cards.length)}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) setDropIndex(null);
      }}
    >
      <div className="canvas-head">
        <span className="mono-label">canvas · session only</span>
        <button className="mono-label text-btn" onClick={() => setCards(DEFAULT_CARDS)} type="button">
          reset layout
        </button>
      </div>
      <div className="canvas-grid">
        {cards.map((card, i) => (
          <section
            key={card.id}
            ref={(el) => {
              if (el) cellRefs.current.set(card.id, el);
              else cellRefs.current.delete(card.id);
            }}
            className={[
              "cell",
              `span-${cardSpan(card)}`,
              card.kind === "pinned" ? "cell-pinned" : "",
              flashId === card.id ? "cell-flash" : "",
              dropIndex === i ? "cell-drop-before" : "",
            ].join(" ")}
            onDragOver={(e) => {
              if (acceptsDrag(e)) {
                e.preventDefault();
                e.stopPropagation();
                setDropIndex(i);
              }
            }}
            onDrop={(e) => handleDrop(e, i)}
          >
            <div className="cell-chrome">
              <span
                className="cell-handle"
                title="drag to rearrange"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(REORDER_MIME, card.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                ⠿
              </span>
              <span className="cell-title mono-label">
                {card.kind === "builtin" ? BUILTIN_TITLE[card.component] : "pinned"}
              </span>
              <button
                className="cell-dismiss"
                title="remove from canvas"
                type="button"
                onClick={() => setCards((cs) => cs.filter((c) => c.id !== card.id))}
              >
                ✕
              </button>
            </div>
            <div className="cell-body">
              {card.kind === "builtin" ? (
                <BuiltinBody component={card.component} view={view} asOfDay={asOfDay} />
              ) : (
                <>
                  <PinnedArtifact query={card.query} view={view} asOfDay={asOfDay} />
                  <p className="provenance mono-label">
                    “{card.provenance.chatQuery}” · {card.query.tool}(
                    {Object.values(card.query.input).filter(Boolean).join(", ")}) · pinned as-of{" "}
                    {card.provenance.pinnedAsOf}
                  </p>
                </>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
