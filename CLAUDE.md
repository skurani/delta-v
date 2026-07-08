# Delta-V — project context

Delta-V (descriptor: "AI Spend Governor") is a FinOps agent POC and portfolio
piece: a chat-primary agent + composable dashboard over a deterministic
FinOps engine. It observes a simulated workload's multi-model LLM/API/compute
spend, meters and attributes it, detects per-slice anomalies, forecasts
against budget, and recommends fixes — with one guardrailed action path.
SPEC.md is the original build spec; DEMO_SCRIPT.md is the repeatable demo.

## Core principle: math for the meter, LLM for the judgment

Metering, attribution, anomaly detection, forecasting, and savings estimates
are ARITHMETIC (src/*.ts engine modules). The LLM only narrates and decides
which tools to call — it must NEVER re-derive or estimate a figure a tool can
provide (src/routing-economics.ts exists precisely so "rerouting saves $X/mo"
is computed, not guessed). The chat system prompt enforces this; keep it that
way in any change.

## Honest-defaults discipline (non-negotiable)

Thresholds, budgets, and anomaly sizes are independently justified generic
defaults — NEVER tuned to make the demo look good. Precedents:
- Monthly budget $3,000 = baseline ~$2.8k + normal headroom (src/app/config.ts).
  The anomaly does NOT breach it; "topline fine, slice on fire" is the story.
- Detector: 1.8x trailing-14-day MEDIAN + $1/day excess floor. The preset's
  1.5x volume flood correctly does NOT fire — that's precision, not a miss.
- Guardrail authority limit $50/mo ≈ half the affected feature's run-rate.
When a desired demo outcome and honest numbers conflict, keep the honest
numbers and change the narrative, not the inputs.

## Architecture

```
data/usage-events.json  (seeded synthetic generator — src/generator.ts, presets.ts)
        │
   ENGINE (pure math, src/): meter.ts → attribution.ts → anomaly.ts →
        │  forecast.ts → routing-economics.ts → summarize.ts
        │
        ├── client (src/app/): App holds world state (as-of day, role) and
        │   computes the engine view in-browser; Canvas renders builtin +
        │   pinned cards from it (pins store QUERIES, resolved live client-side)
        │
        └── server (server/): reason-server.ts (port 8787, holds API key)
            ├── POST /api/reason — one batched analysis per window, disk-cached
            └── POST /api/chat  — agent loop: claude-opus-4-8 picks tools →
                tools.ts executes against the same engine → model narrates.
                History is client-held, echoed opaquely (thinking blocks intact).
```

- **Tools** (server/tools.ts): 7 read tools + 2 action tools (cap_budget,
  throttle_workload). Read tools wrap engine functions 1:1.
- **Guardrail** (server/policy.ts): deterministic checkGuardrail() inside the
  tool executor — role gate (member/FinOps never executes) + impact gate
  (admin/Eng holds when estimated monthly impact > $50). The model narrates
  the verdict it is handed; it never evaluates its own authority. HOLD is a
  successful outcome, not an error.
- **Roles**: UI labels FinOps/Eng map to wire values member/admin. This is a
  PERMISSION GATE (can this role execute at all / within what impact), not an
  approval workflow — held actions are "escalated" in narration only; nothing
  queues for later approval. (Approval workflow is a planned later evolution.)
- **Mock mode**: USE_MOCK_LLM=true swaps the model for a scripted golden-path
  stand-in (server/llm.ts) with the exact Anthropic response shape. Tool
  execution, guardrail, and charts run REAL — narrations are templated from
  actual tool results, so numbers stay honest. Free + deterministic; use it
  for all pipeline/UI work, flip to the real API only for final verification.
  Off-script questions get an explicit "(Mock mode) golden-path only" reply.

## UI (Stage 2a)

Single screen: 64px top bar (Delta-V lockup, as-of scrubber, FinOps/Eng
toggle) · permanent 320px chat dock · canvas = 12-col auto-flow grid of
cards (ordered array; reorder/remove/reset; session-only, no persistence).
Chat artifacts (series/attribution/anomalies) pin to the canvas via button or
drag; pinned cards store the query + provenance and stay live as the scrubber
moves. Guardrail verdicts are chat-only (events, not metrics). Design tokens:
dark Delta-V system in src/app/styles.css — Schibsted Grotesk for human text,
IBM Plex Mono for machine data; signal colors (#8CC3F2 pos / #F2968C neg) are
semantic-only, never decoration.

## Run

```sh
npm run generate                    # (re)build data/usage-events.json — seeded, deterministic
USE_MOCK_LLM=true npm run reason    # agent server on :8787, free mock mode
# real mode: ANTHROPIC_API_KEY in .env (see .env.example), then: npm run reason
npm run dev                         # Vite app on :5173 (proxies /api → :8787)
npm run report                      # console sanity-check of meter/attribution
npx tsc --noEmit && npm run build   # verify
```

Key never reaches the frontend; .env and data/ are gitignored.

## Roadmap

- **Stage 2b (pending):** attribution heatmap, drill-down modal,
  forecast-chart refinements.
- **Fast-follow:** MCP server wrapping the engine tools, so any
  MCP-capable model/client can drive them (tools become model-agnostic).
- **Later:** guardrail evolves from permission gate to approval workflow
  (held actions queue for review instead of narration-only escalation).

## Conventions

- Engine modules stay pure math — no LLM calls, no I/O beyond their inputs.
- Server and client import the SAME engine modules; never fork the logic.
- Verify detector/forecast changes by replaying across as-of days (no
  lookahead: a day is judged only against days before it).
- Commit messages explain the honest-numbers reasoning when defaults change.
