// Agent reasoning panel (SPEC.md §5 screen 3). Shows the FinOps agent's
// analysis openly — finding → why → ranked recommendations → estimated
// impact. One button = one batched LLM call (server-cached, so re-runs of
// the same window are free and instant).

import { useState } from "react";
import type { WindowSummary } from "../summarize";
import { usd } from "./format";

interface Recommendation {
  title: string;
  action: string;
  rationale: string;
  estimated_monthly_savings_usd: number;
  pricing_model: string;
  priority: number;
}

interface Analysis {
  finding: string;
  explanation: string;
  recommendations: Recommendation[];
}

interface ReasonResponse {
  cached: boolean;
  model: string;
  created_at: string;
  analysis: Analysis;
}

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; response: ReasonResponse };

export function ReasoningPanel({ summary }: { summary: WindowSummary }) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function run() {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/reason", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      // Empty body = Vite proxy with the backend down; don't feed it to JSON.parse.
      const raw = await res.text();
      if (!res.ok && raw.trim().length === 0) {
        throw new Error(`agent server unreachable (HTTP ${res.status}) — start it with: npm run reason`);
      }
      const body = JSON.parse(raw);
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ phase: "done", response: body });
    } catch (err) {
      const hint =
        err instanceof TypeError
          ? " — is the reasoning server running? (npm run reason)"
          : "";
      setState({ phase: "error", message: String(err) + hint });
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Agent reasoning</h2>
        <div className="reason-controls">
          {state.phase === "done" && (
            <span className="chip reason-meta">
              {state.response.model}
              {state.response.cached ? " · cached" : ""}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={state.phase === "loading"}
          >
            {state.phase === "loading" ? "Analyzing…" : "Analyze this window"}
          </button>
        </div>
      </div>

      {state.phase === "idle" && (
        <p className="fine-print">
          One batched call: the window's totals, attribution, commitments, forecast, and detected
          anomalies go to the model as a compact summary; it returns a finding, explanation, and
          ranked recommendations. Results are cached per window.
        </p>
      )}

      {state.phase === "error" && <p className="reason-error">{state.message}</p>}

      {state.phase === "done" && (
        <div className="reason-result">
          <p className="reason-finding">{state.response.analysis.finding}</p>
          <p className="reason-explanation">{state.response.analysis.explanation}</p>
          <div className="reason-recs">
            {[...state.response.analysis.recommendations]
              .sort((a, b) => a.priority - b.priority)
              .map((rec) => (
                <div key={rec.title} className="reason-rec">
                  <div className="reason-rec-head">
                    <span className="reason-rec-title">
                      {rec.priority}. {rec.title}
                    </span>
                    <span className="chip pricing-chip">{rec.pricing_model}</span>
                    {rec.estimated_monthly_savings_usd > 0 && (
                      <span className="reason-savings">
                        ~{usd(rec.estimated_monthly_savings_usd)}/mo
                      </span>
                    )}
                  </div>
                  <p className="reason-rec-action">{rec.action}</p>
                  <p className="reason-rec-rationale">{rec.rationale}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
