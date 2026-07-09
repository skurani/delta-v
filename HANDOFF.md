# Delta-V — Session Handoff

*A bookmark for picking up in a fresh chat. For architecture see CLAUDE.md; for the full roadmap see BACKLOG.md; for visual spec see docs/DESIGN.md. This file is only "where we are right now."*

**Last updated:** July 9, 2026

---

## What Delta-V is (one line)
An AI spend governor: a chat-primary agent + composable dashboard over a deterministic FinOps engine, that meters/attributes/forecasts LLM+API+compute spend and governs actions through a guardrail. Product name **Delta-V**; descriptor "AI Spend Governor." Solo build, hobby-with-monetization-intent, alongside an active job search.

## Repo
- Private GitHub: `github.com/driftaudiodev/delta-v`
- Local: `~/finops-agent/ai-spend-agent`
- Resume a session: `cd ~/finops-agent/ai-spend-agent && claude` → "Read CLAUDE.md, BACKLOG.md, and this HANDOFF.md."
- **To run locally:** two terminals, both needed simultaneously — `USE_MOCK_LLM=true npm run reason` (mock agent server, :8787) and `npm run dev` (Vite, :5173). Servers do NOT survive restarts/sleep — restart both every fresh session.

## Current state (as of this handoff) — Milestone 1 build work is COMPLETE
- **Stage 2a** (rebrand, unified layout, pin/drag, reskin) — done, merged, pushed.
- **Stage 2b** (attribution heatmap as a pinnable AGENT TOOL — not a builtin — plus drill-down modal and forecast-chart refinements) — done, merged to main, pushed. Key architectural decision: the heatmap is generated via a `get_cost_matrix` tool call (like every other chat artifact), not a fixed dashboard card, consistent with the chat-primary thesis. Aggregation logic lives once in `src/cost-matrix.ts`, imported by both server tool and client pin-resolver.
- **Design conformance pass** — docs/DESIGN.md (full handoff + brand guidelines) added to repo; six drift items found and fixed against it: wordmark weight/tracking, budget-rule color, anomalous-day highlighting on daily-spend bars (driven live by the detector, not hardcoded), mono tracking split (wide for short labels, tight "annotation" band for long strings like the breadcrumb/heatmap labels to avoid crowding), KPI footnote/progress-bar element, answer-card hover states. Chat-bubble color deliberately left inverted from spec (a kept design choice, not a bug).
- Top-bar breadcrumb (`acme-retail / customer-support / support-agent`) restored — was dropped during the Stage 2a rebrand, caught and fixed.
- `workload_id` schema dimension added; all attribution dimensions reconcile to 100%.
- Everything committed and pushed — clean working tree on `main`.
- **Not yet visually verified this session** — the conformance pass (tracking, KPI footnote, hover states) was verified by type-check/build/width-arithmetic only, no browser tooling available. **First thing to do in a new session: eyeball it in the browser** (wordmark, KPI row progress bar + footnote, heatmap/breadcrumb not crowded, anomalous day red in daily-spend chart, hover states on chat cards).

## Immediate next steps (in order)
1. **Visual eyeball pass** on the conformance-pass changes (see above) — quick, do first.
2. **Tabled together, do next:** demo rehearsal (run DEMO_SCRIPT.md top to bottom in mock mode) + live Opus run (add ANTHROPIC_API_KEY to .env, run golden path on real model — Haiku sanity check first, then Opus; caches after first run). This is genuinely the last item to close Milestone 1 entirely.
3. Milestone 1 done. Then: pick a Milestone 2 starting point from BACKLOG.md (data pipeline/storage is M2-P0's first item — recommended starting point since it's the market-viability foundation everything else sits on).

## Key working disciplines (don't violate — see CLAUDE.md for full detail)
- **Math for the meter, LLM for the judgment** — engine computes numbers; model narrates/decides, never re-derives a figure a tool can provide.
- **Honest defaults, never demo-tuned** — thresholds/budgets/anomaly sizes are generic and defensible, never reverse-engineered to force a demo outcome. (Held again this session: the forecast's over-budget red segment was unit-tested with a synthetic case rather than tuning real data to trigger it.)
- **Deterministic guardrail** — policy is code; model narrates the verdict it's handed.
- **Keys server-side, never committed.**
- **Sequence, don't pile up** — bank a working committed checkpoint before the next big block; branch for risky reworks (stage-2, stage-2b both used this pattern).
- **Server and client import the SAME modules, never fork logic** — the cost-matrix.ts pattern from 2b is the latest example.
- **Mock mode for building/rehearsing** (USE_MOCK_LLM=true) — handles only scripted golden-path questions; free + deterministic. Real Opus only for final validation. Mock phrasing-brittleness (e.g. "heat map" vs "heatmap") is a known scaffold limitation, not a product flaw — the real model handles phrasing robustly by design.

## Product/architecture insights from today (worth knowing before extending further)
- **The heatmap-as-agent-tool decision is a precedent**: ALL visualizations should be chart outputs the agent generates via tool calls, not fixed dashboard builtins — consistent with chat-primary. Apply this same logic to any future visualization.
- **Enforcement reality check (production viability):** Delta-V is a control plane, not a data plane — it can never enforce spend limits by itself. Real enforcement requires a control point in the request path (a gateway like LiteLLM/Portkey that Delta-V writes budget config to). Without a gateway, "capping" honestly degrades to alert-only. This must be labeled explicitly in-product (enforced vs. alert-only), never implied. See BACKLOG.md M2-P1 for the full writeup.
- **Ingestion strategy is more leveraged than it first appears:** the ecosystem converged on OpenTelemetry GenAI semantic conventions over OTLP — one ingestion endpoint covers most instrumented apps AND most gateway exports. Not "build 15 parsers."
- **Attribution is NOT automatic** — tokens/cost/model come free from telemetry; feature/team/user only exist if the customer tags their calls. The AI-assisted attribution-mapping wizard (propose-and-confirm, never silent) is the flagship self-service/differentiation feature for M2.
- **Governance has three maturity layers**, only the first is built: (1) reactive — human asks agent to cap, guardrail governs [built]; (2) proactive — user pre-sets budgets/thresholds [M2 backlog: "user-configurable governance" + "budgeting layer"]; (3) autonomous — system self-triggers guardrailed actions when pre-set policy thresholds are crossed [M2 backlog: "autonomous enforcement"]. The SAME deterministic guardrail governs all three layers — that consistency is the core trust story.

## Housekeeping loose ends (minor, do whenever)
- BACKLOG.md: check whether the five items from today's production-design discussion actually got added (budgeting layer, enforcement modes w/ honest labeling, user-configurable governance, autonomous enforcement, workload anatomy view) — this was queued but may not have been executed before the session moved to design conformance work. **Verify and add if missing.**
- BACKLOG.md: the M2 list had two items both numbered "7" — check if fixed.
- DEMO_SCRIPT.md: check whether the Beat 4 narration line ("in production, pre-set policies trigger this same guardrailed path automatically") was added — also queued, may not be executed.
- Mock matcher: "heat map" (two words) vs "heatmap" (one word) — minor phrasing-robustness gap in mock mode only; real Opus doesn't have this issue.

## Parallel context (not the build, but relevant to time allocation)
Active job search runs alongside this. Delta-V is the thing you *show*, not the priority over outreach/interviews. Recent: applied to Glean + warm message to Emrecan (Head of Product) — awaiting reply. Wade (Netlify, hottest warm lead) — still no reply, one light follow-up may be warranted. Message sent to Jewel (Amazon Music/Alexa Audio) — awaiting reply. Call with Will scheduled 3pm July 9 (context/prep not established in this thread — clarify at start of relevant conversation). Job-search tracker is a separate file. Quick check for replies is worth doing at the start of any session before deep build work.
