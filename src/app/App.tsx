// Delta-V shell (Stage 2a): single screen — 64px top bar, permanent 320px
// chat dock left, canvas right. No tabs. World state (as-of day, role),
// conversation state, and canvas layout all live here; everything below is
// props. The as-of scrubber re-runs metering + attribution + forecast +
// detection on the events up to that day, so every number — builtin cards
// and live pinned cards alike — is honest for that point in time.
// Canvas/pin state is in-memory, session-only (no persistence by design).

import { useEffect, useMemo, useRef, useState } from "react";
import { detectAnomalies } from "../anomaly";
import { attribute } from "../attribution";
import { forecast } from "../forecast";
import { meterEvents } from "../meter";
import type { GeneratorConfig, UsageEvent } from "../schema";
import { buildWindowSummary } from "../summarize";
import {
  Canvas,
  DEFAULT_CARDS,
  type CanvasCard,
  type EngineView,
  type PinQuery,
  type Provenance,
} from "./Canvas";
import { Chat, type DisplayTurn } from "./Chat";
import { MONTHLY_BUDGET } from "./config";
import { ROLE_LABEL, TopBar, type Role } from "./TopBar";

interface DataFile {
  generated_at: string;
  config: GeneratorConfig;
  events: UsageEvent[];
}

export function App() {
  const [data, setData] = useState<DataFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOfIndex, setAsOfIndex] = useState<number | null>(null);
  const [role, setRole] = useState<Role>("member");
  const [chatTurns, setChatTurns] = useState<DisplayTurn[]>([]);
  const chatApiMessages = useRef<unknown[]>([]);
  const [cards, setCards] = useState<CanvasCard[]>(DEFAULT_CARDS);
  const [serverMode, setServerMode] = useState<"mock" | "real" | "offline" | null>(null);

  // Mode badge data: checked once at page load (the demo flow starts the
  // server before the browser opens; no live tracking by design).
  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((h) => setServerMode(h.mode === "mock" ? "mock" : "real"))
      .catch(() => setServerMode("offline"));
  }, []);

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

  const dayIndex = asOfIndex ?? allDays.length - 1;
  const asOfDay = allDays[dayIndex] ?? "";

  const view = useMemo<EngineView | null>(() => {
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
    const elapsedDays = allDays.slice(0, allDays.indexOf(asOfDay) + 1);
    // Detection sees only elapsed days — no lookahead.
    const alerts = detectAnomalies(metered.events, elapsedDays);
    const summary = buildWindowSummary(data.config, metered, attributed, fc, alerts);
    return { metered, attributed, fc, alerts, summary, elapsedDays, allDays };
  }, [data, asOfDay, allDays]);

  function pinCard(query: PinQuery, provenance: Provenance) {
    setCards((cs) => [
      ...cs,
      { id: `pin-${Date.now()}-${cs.length}`, kind: "pinned", query, provenance },
    ]);
  }

  if (error) return <div className="load-state">Failed to load usage data: {error}</div>;
  if (!data || !view) return <div className="load-state">Loading usage events…</div>;

  return (
    <div className="shell">
      <TopBar
        asOfDay={asOfDay}
        dayIndex={dayIndex}
        dayCount={allDays.length}
        daysElapsed={view.fc.daysElapsed}
        daysTotal={view.fc.daysTotal}
        onScrub={setAsOfIndex}
        role={role}
        onRoleChange={setRole}
        serverMode={serverMode}
        context={{
          customerId: data.config.customer_id,
          teamId: data.config.team_id,
          workloadId: data.config.workload_id,
        }}
      />
      <div className="main">
        <Chat
          role={role}
          roleLabel={ROLE_LABEL[role]}
          asOfDay={asOfDay}
          events={view.metered.events}
          turns={chatTurns}
          setTurns={setChatTurns}
          apiMessages={chatApiMessages}
          onPin={pinCard}
        />
        <Canvas cards={cards} setCards={setCards} view={view} asOfDay={asOfDay} />
      </div>
      <div className="grain" aria-hidden="true" />
    </div>
  );
}
