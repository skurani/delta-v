// Chat — the primary surface. The agent decides which engine tools to call;
// the server executes them against the real data; results render inline as
// the same chart components the dashboard uses. History is client-held and
// echoed opaquely (full API message shapes, thinking blocks included).

import { useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnomalyAlert } from "../anomaly";
import type { Rollup } from "../attribution";
import { AlertCards } from "./AlertCard";
import { BreakdownCard } from "./Breakdowns";
import { shortDay, usd2 } from "./format";
import { GuardrailCard, type ActionResult } from "./GuardrailCard";

interface ToolEvent {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
}

interface DisplayTurn {
  who: "user" | "agent";
  text: string;
  toolEvents?: ToolEvent[];
}

const SUGGESTIONS = [
  "How's my spend looking this month?",
  "Why did my LLM spend spike?",
  "What would fixing it save?",
  "Cap the draft_reply budget at $20/mo",
];

function SeriesChart({ result }: { result: { key: string; series: { day: string; cost: number }[] } }) {
  const data = result.series.map((p) => ({ ...p, day: shortDay(p.day) }));
  return (
    <div className="chat-chart">
      <h3>daily cost — {result.key}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0, 0, 0, 0.08)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} width={46} />
          <Tooltip
            formatter={(value) => [usd2(Number(value ?? 0)), "cost"]}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="cost" stroke="#DF68EB" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ToolArtifact({ event }: { event: ToolEvent }) {
  const r = event.result as Record<string, unknown> | unknown[] | null;
  if (r === null || (typeof r === "object" && "error" in (r as object))) return null;
  switch (event.tool) {
    case "get_daily_series":
      return <SeriesChart result={event.result as { key: string; series: { day: string; cost: number }[] }} />;
    case "get_attribution": {
      const res = event.result as { dimension: string; entries: ({ key: string } & Rollup)[] };
      const dim = Object.fromEntries(res.entries.map(({ key, ...rollup }) => [key, rollup]));
      return (
        <div className="chat-chart">
          <BreakdownCard title={`by ${res.dimension}`} dim={dim} />
        </div>
      );
    }
    case "get_anomalies": {
      const alerts = event.result as AnomalyAlert[];
      return alerts.length > 0 ? <AlertCards alerts={alerts} /> : null;
    }
    case "cap_budget":
    case "throttle_workload":
      return <GuardrailCard result={event.result as ActionResult} />;
    default:
      return null;
  }
}

export function Chat({ role, asOfDay }: { role: "admin" | "member"; asOfDay: string }) {
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const apiMessages = useRef<unknown[]>([]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setTurns((t) => [...t, { who: "user", text }]);
    apiMessages.current = [
      ...apiMessages.current,
      { role: "user", content: [{ type: "text", text }] },
    ];
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: apiMessages.current, role, as_of_day: asOfDay }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      apiMessages.current = body.messages;
      setTurns((t) => [...t, { who: "agent", text: body.reply, toolEvents: body.toolEvents }]);
    } catch (err) {
      const hint =
        err instanceof TypeError ? " — is the server running? (npm run reason)" : "";
      setTurns((t) => [...t, { who: "agent", text: `Error: ${String(err)}${hint}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {turns.length === 0 && (
          <div className="chat-empty">
            <p className="fine-print">
              Ask about the workload's spend. The agent answers by calling the metering engine —
              it never invents numbers. Actions run through a guardrail. Try:
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip suggestion-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`chat-turn chat-${turn.who}`}>
            {turn.who === "agent" && turn.toolEvents && turn.toolEvents.length > 0 && (
              <div className="chat-tools-used">
                {turn.toolEvents.map((e, j) => (
                  <span key={j} className="chip tool-chip">
                    {e.tool}
                  </span>
                ))}
              </div>
            )}
            <div className="chat-bubble">{turn.text}</div>
            {turn.toolEvents?.map((e, j) => <ToolArtifact key={j} event={e} />)}
          </div>
        ))}
        {busy && <div className="chat-turn chat-agent"><div className="chat-bubble chat-thinking">Working…</div></div>}
      </div>
      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="chat-input"
          value={input}
          placeholder={`Ask about spend (as of ${asOfDay}, acting as ${role})…`}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
