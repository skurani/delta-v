// Feature × model heatmap (Stage 2b) + drill-down modal.
//
// Renders a CostMatrix (the get_cost_matrix tool's output shape) per the
// handoff gradient rule: cells fill rgba(140,195,242, α) with α scaling
// linearly 0.05–0.95 against the max cell; cell text flips dark at α ≥ 0.4.
// Empty combos render borderless with a dash. 6px gap, 30px min cell height.
//
// Clicking a cell opens the drill-down: the REAL events behind that
// (feature, model) slice, filtered from the current view — the header
// count/total are computed from the same filtered set the table shows, so
// the modal always reconciles with itself.

import { useEffect, useMemo, useState } from "react";
import type { CostMatrix } from "../cost-matrix";
import type { RatedEvent } from "../meter";
import { usd2 } from "./format";

const ALPHA_MIN = 0.05;
const ALPHA_MAX = 0.95;
const TEXT_FLIP = 0.4;
const MODAL_ROW_CAP = 150;

function cellAlpha(cost: number, max: number): number {
  if (max <= 0) return ALPHA_MIN;
  return ALPHA_MIN + (cost / max) * (ALPHA_MAX - ALPHA_MIN);
}

interface Slice {
  feature: string;
  model: string;
}

function DrillModal({
  slice,
  events,
  asOfDay,
  onClose,
}: {
  slice: Slice;
  events: RatedEvent[];
  asOfDay: string;
  onClose: () => void;
}) {
  const rows = useMemo(
    () =>
      events
        .filter((e) => e.feature === slice.feature && e.model === slice.model)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [events, slice],
  );
  const total = rows.reduce((a, e) => a + e.rated_cost, 0);
  const shown = rows.slice(0, MODAL_ROW_CAP);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="modal-title">
              {slice.feature} × {slice.model}
            </span>
            <span className="mono-label modal-meta">
              {rows.length.toLocaleString()} events · {usd2(total)} · as of {asOfDay}
            </span>
          </div>
          <button className="cell-dismiss" onClick={onClose} title="close" type="button">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <table className="drill-table">
            <thead>
              <tr>
                <th>timestamp</th>
                <th>user</th>
                <th className="num">tokens</th>
                <th className="num">$/token</th>
                <th className="num">rated cost</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={i}>
                  <td>{e.timestamp.slice(0, 16).replace("T", " ")}</td>
                  <td>{e.user_id ?? "autonomous"}</td>
                  <td className="num">{e.quantity.toLocaleString()}</td>
                  <td className="num">{e.unit_cost}</td>
                  <td className="num">{usd2(e.rated_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > MODAL_ROW_CAP && (
            <p className="mono-label modal-cap-note">
              showing {MODAL_ROW_CAP} of {rows.length.toLocaleString()} (newest first)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Heatmap({
  matrix,
  events,
  asOfDay,
}: {
  matrix: CostMatrix;
  events: RatedEvent[];
  asOfDay: string;
}) {
  const [slice, setSlice] = useState<Slice | null>(null);

  if (matrix.cells.length === 0) {
    return <p className="mono-label">no llm spend in this window</p>;
  }

  const cellFor = new Map(matrix.cells.map((c) => [`${c.row} ${c.col}`, c]));

  return (
    <div className="heatmap">
      <div className="heatmap-scope mono-label">
        {matrix.row_dimension} × {matrix.col_dimension} · llm spend · {usd2(matrix.total_cost)}
      </div>
      <div
        className="heatmap-grid"
        style={{ gridTemplateColumns: `minmax(90px, auto) repeat(${matrix.cols.length}, 1fr)` }}
      >
        <span />
        {matrix.cols.map((col) => (
          <span key={col} className="heatmap-col-label mono-label" title={col}>
            {col}
          </span>
        ))}
        {matrix.rows.map((row) => (
          <HeatmapRow
            key={row}
            row={row}
            cols={matrix.cols}
            cellFor={cellFor}
            max={matrix.max_cell_cost}
            onSelect={setSlice}
          />
        ))}
      </div>
      {slice && (
        <DrillModal slice={slice} events={events} asOfDay={asOfDay} onClose={() => setSlice(null)} />
      )}
    </div>
  );
}

function HeatmapRow({
  row,
  cols,
  cellFor,
  max,
  onSelect,
}: {
  row: string;
  cols: string[];
  cellFor: Map<string, { cost: number; events: number }>;
  max: number;
  onSelect: (slice: Slice) => void;
}) {
  return (
    <>
      <span className="heatmap-row-label mono-label" title={row}>
        {row}
      </span>
      {cols.map((col) => {
        const cell = cellFor.get(`${row} ${col}`);
        if (!cell) {
          return (
            <span key={col} className="heatmap-cell heatmap-cell-empty">
              —
            </span>
          );
        }
        const alpha = cellAlpha(cell.cost, max);
        return (
          <button
            key={col}
            type="button"
            className="heatmap-cell"
            style={{
              background: `rgba(140, 195, 242, ${alpha.toFixed(3)})`,
              color: alpha >= TEXT_FLIP ? "var(--bg-page)" : "var(--text-1)",
            }}
            title={`${row} × ${col} — ${usd2(cell.cost)}, ${cell.events.toLocaleString()} events. Click to drill down.`}
            onClick={() => onSelect({ feature: row, model: col })}
          >
            {usd2(cell.cost)}
          </button>
        );
      })}
    </>
  );
}
