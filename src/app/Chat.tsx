// Chat dock — the permanent left rail. The agent decides which engine tools
// to call; the server executes them; results render inline as artifacts.
// Pinnable artifacts (series, attribution, anomalies) carry a PIN button
// (primary path) and are draggable onto the canvas (enhancement). History is
// client-held in App state and echoed opaquely (thinking blocks included).

import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AnomalyAlert } from "../anomaly";
import type { Rollup } from "../attribution";
import { AlertCards } from "./AlertCard";
import { BreakdownCard } from "./Breakdowns";
import { PIN_DRAG_MIME, type PinQuery, type Provenance } from "./Canvas";
import { GuardrailCard, type ActionResult } from "./GuardrailCard";
import { SeriesChart, type SeriesResult } from "./SeriesChart";

interface ToolEvent {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
}

// Conversation state lives in App (above the layout), so nothing here is
// lost to re-renders elsewhere.
export interface DisplayTurn {
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

const PINNABLE = new Set(["get_daily_series", "get_attribution", "get_anomalies"]);

function isPinnable(event: ToolEvent): boolean {
  if (!PINNABLE.has(event.tool)) return false;
  if (event.tool === "get_anomalies") return Array.isArray(event.result) && event.result.length > 0;
  const r = event.result as Record<string, unknown> | null;
  return r !== null && !(typeof r === "object" && "error" in r);
}

function ArtifactBody({ event }: { event: ToolEvent }) {
  const r = event.result as Record<string, unknown> | unknown[] | null;
  if (r === null || (typeof r === "object" && !Array.isArray(r) && "error" in r)) return null;
  switch (event.tool) {
    case "get_daily_series":
      return <SeriesChart result={event.result as SeriesResult} height={120} />;
    case "get_attribution": {
      const res = event.result as { dimension: string; entries: ({ key: string } & Rollup)[] };
      const dim = Object.fromEntries(res.entries.map(({ key, ...rollup }) => [key, rollup]));
      return <BreakdownCard title={`by ${res.dimension}`} dim={dim} />;
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

function ToolArtifact({
  event,
  chatQuery,
  asOfDay,
  onPin,
}: {
  event: ToolEvent;
  chatQuery: string;
  asOfDay: string;
  onPin: (query: PinQuery, provenance: Provenance) => void;
}) {
  const body = ArtifactBody({ event });
  if (body === null) return null;

  if (!isPinnable(event)) return <div className="artifact">{body}</div>;

  const query: PinQuery = { tool: event.tool as PinQuery["tool"], input: event.input };
  const provenance: Provenance = {
    chatQuery,
    pinnedAsOf: asOfDay,
    pinnedAt: new Date().toISOString(),
  };
  return (
    <div className="artifact artifact-pinnable">
      <div
        className="artifact-head"
        draggable
        title="drag onto the canvas, or use PIN"
        onDragStart={(e) => {
          e.dataTransfer.setData(PIN_DRAG_MIME, JSON.stringify({ query, provenance }));
          e.dataTransfer.effectAllowed = "copy";
        }}
      >
        <span className="mono-label">{event.tool}</span>
        <button className="pin-btn mono-label" type="button" onClick={() => onPin(query, provenance)}>
          pin
        </button>
      </div>
      {body}
    </div>
  );
}

export function Chat({
  role,
  roleLabel,
  asOfDay,
  turns,
  setTurns,
  apiMessages,
  onPin,
}: {
  role: "admin" | "member";
  roleLabel: string;
  asOfDay: string;
  turns: DisplayTurn[];
  setTurns: Dispatch<SetStateAction<DisplayTurn[]>>;
  apiMessages: MutableRefObject<unknown[]>;
  onPin: (query: PinQuery, provenance: Provenance) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

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
      // Read text first: when the backend is down, the Vite proxy answers
      // 500 with an EMPTY body — res.json() would throw a bare SyntaxError.
      const raw = await res.text();
      if (!res.ok && raw.trim().length === 0) {
        throw new Error(
          `agent server unreachable (HTTP ${res.status}) — start it with: npm run reason` +
            " (or USE_MOCK_LLM=true npm run reason for the free mock)",
        );
      }
      let body: { error?: string; messages: unknown[]; reply: string; toolEvents: ToolEvent[] };
      try {
        body = JSON.parse(raw);
      } catch {
        throw new Error(`server returned a non-JSON response (HTTP ${res.status}): ${raw.slice(0, 120)}`);
      }
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

  /** The user question that produced the agent turn at index i. */
  const queryFor = (i: number): string => {
    for (let j = i - 1; j >= 0; j--) if (turns[j].who === "user") return turns[j].text;
    return "";
  };

  return (
    <aside className="chat-dock">
      <div className="chat-log">
        {turns.length === 0 && (
          <div className="chat-empty">
            <p className="chat-hint">
              Ask about the workload's spend. The agent answers by calling the metering engine —
              it never invents numbers. Actions run through a guardrail. Try:
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip suggestion-chip" onClick={() => send(s)} type="button">
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
            {turn.toolEvents?.map((e, j) => (
              <ToolArtifact key={j} event={e} chatQuery={queryFor(i)} asOfDay={asOfDay} onPin={onPin} />
            ))}
          </div>
        ))}
        {busy && (
          <div className="chat-turn chat-agent">
            <div className="chat-bubble chat-thinking">Working…</div>
          </div>
        )}
      </div>
      {turns.length > 0 && (
        <div className="chat-try-row">
          <span className="mono-label">try also</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="chip suggestion-chip"
              onClick={() => send(s)}
              disabled={busy}
              type="button"
            >
              {s}
            </button>
          ))}
        </div>
      )}
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
          placeholder={`Ask (as of ${asOfDay}, as ${roleLabel})…`}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
