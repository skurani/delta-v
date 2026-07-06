// Anomaly alert cards (SPEC.md §5 screen 2). One card per detected alert,
// explicitly labeled by type — a cost-mix anomaly (unit economics shifted)
// and a volume anomaly (usage grew) are different signals, not duplicates.

import type { AnomalyAlert, Episode } from "../anomaly";
import { RATIO_THRESHOLD } from "../anomaly";
import { shortDay, usd2 } from "./format";

const TYPE_LABEL: Record<AnomalyAlert["type"], string> = {
  cost_mix: "cost-mix anomaly",
  volume: "volume anomaly",
};

const SLICE_LABEL: Record<string, string> = {
  llm: "LLM spend",
  api: "API spend",
  compute: "Compute spend",
  subscription: "Subscription spend",
};

function driverLine(d: Episode): string {
  return `${d.slice} peaked at ${d.peakRatio}x baseline (+${usd2(d.cumulativeExcess)} excess)`;
}

export function AlertCards({ alerts }: { alerts: AnomalyAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <>
      {alerts.map((a) => {
        const e = a.episode;
        const slice = SLICE_LABEL[e.slice] ?? `${e.slice} spend`;
        return (
          <section key={`${e.slice}-${e.startDay}`} className={`card alert-card alert-${a.type}`}>
            <div className="card-head">
              <h2>
                {slice} anomaly —{" "}
                {e.ongoing ? `ongoing since ${shortDay(e.startDay)}` : `${shortDay(e.startDay)} to ${shortDay(e.endDay)}`}
              </h2>
              <span className={`chip alert-chip-${a.type}`}>{TYPE_LABEL[a.type]}</span>
            </div>

            <p className="alert-why">
              On {shortDay(e.peakDay)}, {slice.toLowerCase()} hit <strong>{usd2(e.peakCost)}</strong> —{" "}
              <strong>{e.peakRatio}x</strong> the trailing 14-day median of {usd2(e.peakBaseline)}{" "}
              (threshold {RATIO_THRESHOLD}x). Cumulative excess ≈ <strong>{usd2(e.cumulativeExcess)}</strong>.
            </p>

            <p className="alert-classification">
              {a.type === "cost_mix" ? (
                <>
                  Cost per event rose <strong>{e.unitEconRatio}x</strong> — the spend mix shifted
                  toward expensive units, not just more usage.
                </>
              ) : (
                <>
                  Cost per event held roughly flat ({e.unitEconRatio}x) — spend rose because usage
                  volume rose.
                </>
              )}
            </p>

            {a.drivers.length > 0 && (
              <div className="alert-drivers">
                <h3>Drivers</h3>
                {a.drivers.map((d) => (
                  <div key={`${d.dimension}-${d.slice}`} className="alert-driver">
                    <span className="chip driver-chip">{d.dimension}</span> {driverLine(d)}
                  </div>
                ))}
              </div>
            )}

            <p className="fine-print">
              Invoice-level check: total daily spend that day was {usd2(a.invoiceCheck.peakDayTotal)}{" "}
              — {a.invoiceCheck.totalRatio}x its own baseline, {a.invoiceCheck.wouldHaveFired
                ? "which would also have fired at the blended level."
                : `below the ${RATIO_THRESHOLD}x threshold. This spike is invisible in the blended total.`}
            </p>
          </section>
        );
      })}
    </>
  );
}
