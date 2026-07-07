// Attribution breakdowns: top-N bar lists per dimension — the
// "whose spend is this / what's it for" grid.

import type { AttributionResult, Rollup } from "../attribution";
import { topEntries } from "../attribution";
import { pct, usd2 } from "./format";

export function BreakdownCard({
  title,
  dim,
  limit = 6,
}: {
  title: string;
  dim: Record<string, Rollup>;
  limit?: number;
}) {
  const entries = topEntries(dim, limit);
  const max = entries.length > 0 ? entries[0][1].cost : 1;
  return (
    <div className="breakdown">
      <h3>{title}</h3>
      {entries.map(([key, r]) => (
        <div key={key} className="breakdown-row">
          <span className="breakdown-key" title={key}>
            {key}
          </span>
          <div className="breakdown-bar">
            <div className="breakdown-fill" style={{ width: `${(r.cost / max) * 100}%` }} />
          </div>
          <span className="breakdown-cost">{usd2(r.cost)}</span>
          <span className="breakdown-share">{pct(r.share)}</span>
        </div>
      ))}
    </div>
  );
}

export function Breakdowns({ attributed }: { attributed: AttributionResult }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Attribution</h2>
        <span className="subtitle">rated total {usd2(attributed.totalCost)}</span>
      </div>
      <div className="breakdown-grid">
        <BreakdownCard title="By provider" dim={attributed.byProvider} />
        <BreakdownCard title="By model" dim={attributed.byModel} />
        <BreakdownCard title="By feature" dim={attributed.byFeature} />
        <BreakdownCard title="By resource type" dim={attributed.byResourceType} />
        <BreakdownCard title="Seat vs consumption" dim={attributed.bySeat} />
        <BreakdownCard title="By user" dim={attributed.byUser} limit={8} />
      </div>
    </section>
  );
}
