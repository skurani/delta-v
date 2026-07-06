// Forecast vs budget gauge: one horizontal bar showing spend to date and
// the projected month-end position against the budget.

import type { ForecastResult } from "../forecast";
import { usd, usd2 } from "./format";

const STATUS_LABEL: Record<ForecastResult["status"], string> = {
  under: "On track",
  near: "Approaching budget",
  over: "Projected over budget",
};

export function ForecastCard({ fc }: { fc: ForecastResult }) {
  // Scale the bar so the budget marker sits at ~85% width even if the
  // projection overshoots it.
  const scaleMax = Math.max(fc.budget, fc.projectedTotal) * 1.18;
  const w = (x: number) => `${Math.min(100, (x / scaleMax) * 100)}%`;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Forecast vs budget</h2>
        <span className={`chip status-${fc.status}`}>{STATUS_LABEL[fc.status]}</span>
      </div>
      <div className="gauge">
        <div className="gauge-track">
          <div className="gauge-fill projected" style={{ width: w(fc.projectedTotal) }} />
          <div className="gauge-fill spent" style={{ width: w(fc.spendToDate) }} />
          <div className="gauge-budget-marker" style={{ left: w(fc.budget) }}>
            <span>budget {usd(fc.budget)}</span>
          </div>
        </div>
        <div className="gauge-legend">
          <span>
            <i className="swatch spent" /> to date {usd2(fc.spendToDate)}
          </span>
          <span>
            <i className="swatch projected" /> projected {usd2(fc.projectedTotal)}
          </span>
          <span className={`status-${fc.status}`}>
            {fc.variance > 0 ? "+" : ""}
            {usd2(fc.variance)} vs budget
          </span>
        </div>
      </div>
      <p className="fine-print">
        Projection = fixed {usd2(fc.projectedFixed)} + variable {usd2(fc.projectedVariable)}
        {fc.projectedOverage > 0 ? ` + projected overage ${usd2(fc.projectedOverage)}` : ""} ·
        variable burn {usd2(fc.variableDailyBurn)}/day (trailing 7-day avg)
      </p>
    </section>
  );
}
