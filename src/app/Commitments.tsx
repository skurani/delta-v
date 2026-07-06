// Commitment utilization: usage-vs-committed is a core FinOps view —
// underutilized commits are overpayment, overage means renegotiate.

import type { CommitmentStatus } from "../meter";
import { pct, usd2 } from "./format";

const STATUS_LABEL: Record<CommitmentStatus["status"], string> = {
  underutilized: "Underutilized",
  on_track: "On track",
  overage: "In overage",
};

export function Commitments({ commitments }: { commitments: CommitmentStatus[] }) {
  if (commitments.length === 0) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Commitments</h2>
      </div>
      {commitments.map((c) => (
        <div key={`${c.provider}/${c.feature}`} className="commitment">
          <div className="commitment-head">
            <span>
              {c.provider} / {c.feature}
            </span>
            <span className={`chip commit-${c.status}`}>{STATUS_LABEL[c.status]}</span>
          </div>
          <div className="commit-track">
            <div
              className={`commit-fill commit-${c.status}`}
              style={{ width: `${Math.min(100, c.utilization * 100)}%` }}
            />
          </div>
          <div className="commitment-detail">
            {c.usedQuantity.toLocaleString()} of {c.includedQuantity.toLocaleString()} {c.unit} (
            {pct(c.utilization)}) · commit {usd2(c.committedCost)}
            {c.overageCost > 0 ? ` + overage ${usd2(c.overageCost)}` : ""} = {usd2(c.ratedCost)}
          </div>
        </div>
      ))}
    </section>
  );
}
