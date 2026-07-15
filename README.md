# Delta-V

**AI Spend Control Plane** — a FinOps agent that watches a workload's multi-model
LLM/API/compute spend, meters and attributes every event, catches the
anomalies a blended invoice hides, forecasts against budget, and recommends
fixes. One guardrailed action path lets it *act* within scoped authority —
and hold + escalate when a request exceeds it.

Chat is the primary surface: the agent answers by calling deterministic
engine tools (it never invents numbers), and any chart it produces can be
pinned to a composable dashboard canvas where it stays live.

> Portfolio/interview POC on synthetic data (seeded, deterministic
> generator). The principle throughout: **math for the meter, LLM for the
> judgment** — and honest defaults, never demo-tuned.

## Quick start

```sh
npm install
npm run generate                    # build the synthetic event stream (seeded)
USE_MOCK_LLM=true npm run reason    # agent server on :8787 — free, deterministic mock
npm run dev                         # app on :5173
```

Real model instead of the mock: copy `.env.example` to `.env`, add your
`ANTHROPIC_API_KEY`, and run `npm run reason` without the flag. The API key
lives server-side only.

Then follow **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** — a 5-beat golden path from
"how's my spend?" to the guardrail holding an over-authority action.

## Architecture

```
synthetic events ─→ ENGINE (pure math)          ─→ tools ─→ AGENT (claude-opus-4-8)
                    meter · attribution ·           │        picks tools, narrates,
                    anomaly detection ·             │        never re-derives figures
                    forecast · routing economics    │
                                                    └─→ GUARDRAIL (deterministic)
                                                        role gate + impact limit;
                                                        allow / hold + escalate
```

- **Engine** (`src/*.ts`) — rates all four pricing models (per-token,
  per-call, committed, flat), rolls up 9 attribution dimensions, detects
  per-slice anomalies against a trailing-median baseline (the 3x LLM spike
  moves the blended total just 1.14x — invisible at invoice level), and
  computes routing-change savings as arithmetic, not model guesses.
- **Agent server** (`server/`) — thin Node server holding the API key.
  `POST /api/chat` runs the tool-calling loop; `USE_MOCK_LLM=true` swaps in a
  scripted mock with the identical response shape (pipeline runs real,
  decisions are canned, numbers stay honest).
- **UI** (`src/app/`) — permanent chat dock + canvas grid. Pin any chat
  chart to the canvas; pins store the *query* and re-resolve live as the
  as-of-day scrubber replays the window. FinOps/Eng role toggle drives the
  guardrail's permission gate.

## Commands

| Command | What it does |
|---|---|
| `npm run generate` | (Re)build `data/usage-events.json` from the seeded config |
| `npm run reason` | Agent server on :8787 (`USE_MOCK_LLM=true` for mock mode) |
| `npm run dev` | Vite app on :5173, proxies `/api` to the server |
| `npm run report` | Console sanity-check: metering, attribution, reconciliation |
| `npm run build` | Production build |
