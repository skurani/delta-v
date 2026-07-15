# Delta-V — Backlog & Definition of Done

**Product:** Delta-V — an AI spend control plane. A chat-primary agent plus a composable dashboard that meters, attributes, forecasts, and governs LLM/API/compute spend over a metered workload.

**Purpose of this doc:** the running backlog and the explicit finish line for the POC. Two horizons: **POC (the demoable artifact)** and **Beyond POC (the monetizable MVP path)**. Items are checked when their done-criteria are met.

---

## Two milestones (not one fuzzy "done")

Delta-V has two distinct finish lines. They are sequenced, not merged: bank Milestone 1 fully, then pursue Milestone 2. This keeps the demoable artifact's full attribution richness (synthetic data carries feature/team/user tags that raw provider bills do not) while preserving the real-data path as its own deliberate step.

### Milestone 1 — POC (synthetic data) ← current target

Done when a first-time viewer can, without help, watch the full story end-to-end and it holds up to scrutiny:

1. **The story lands in one sitting.** Chat-primary flow: ask about spend → agent surfaces the hidden anomaly → explains it with grounded numbers → proposes a computed fix → attempts an action → guardrail governs it. No dead ends, no unexplained screens.
2. **Every number is defensible.** No figure invented by the LLM; all trace to the engine. No thresholds/budgets/anomaly sizes tuned to force the demo.
3. **The guardrail demonstrably governs.** Both gates provable live: role gate (FinOps can't execute) and impact gate (even Eng is held on a too-large action).
4. **It runs reliably on the golden path.** Repeatable via DEMO_SCRIPT.md, on the real model (Opus), cached so re-runs are free.
5. **It looks like a product.** Delta-V branding, legible, composable canvas works (pin + live-update).
6. **It's documented and version-controlled.** CLAUDE.md, README, private GitHub repo.

When all six hold, Milestone 1 is done. This is the thing you demo.

### Milestone 2 — Real-data MVP (later, separate finish line)

Done when real usage data can flow through the same engine instead of only synthetic:

1. **Real ingestion works** via at least one path — provider billing exports (Anthropic/OpenAI usage APIs, AWS CUR/FOCUS; coarse but easy) and/or SDK/gateway instrumentation (rich, harder). The schema already *is* the emit contract.
2. **The coarser-data tradeoff is confronted deliberately.** Real provider bills lack feature/team/user tags; decide how attribution degrades gracefully (or require instrumentation for the rich views).
3. Whatever subset of auth / persistence / multi-tenancy / real execution a first pilot user genuinely needs — scoped when Milestone 2 is actually started, not pre-committed here.

Milestone 2 is NOT required to call Milestone 1 done. It is the monetization path, sequenced after.

---

## DONE ✓ (built, verified, committed)

- **Engine — schema + generator.** FOCUS-flavored UsageEvent, config-driven, customer-support + coding-agent presets, 30-day window with a tuned ~4x anomaly, user_id/seat attribution.
- **Engine — metering.** Rates all four pricing models (per_token, per_call, committed w/ overage, flat); committed fee allocated pro rata; reconciles to 100%.
- **Engine — attribution.** Rollups by customer, team, feature, provider, model, resource_type, user, seat-vs-autonomous.
- **Engine — anomaly detection.** Per-dimension (not blended total), median-baseline dual-threshold (1.8x + $1/day floor), episode grouping, typed cost-mix/volume classification, no-lookahead scrubber replay.
- **Engine — forecast.** Fixed/variable/overage split projection vs. an independently-set budget.
- **Engine — routing economics.** Computed counterfactual savings (not model-guessed), with quality caveat.
- **Agent — tool-calling loop.** Read tools + action tools; server-side key custody; batched, cached.
- **Guardrail.** Deterministic policy (code decides, model narrates); role gate + impact gate, both proven independently.
- **Mock mode.** Byte-shape-identical responses; free/deterministic golden-path build + test.
- **Chat UI.** Persistent chips, history survives navigation, inline charts/cards.
- **Stage 2a.** Delta-V rebrand; unified single-screen (320px chat dock + canvas grid); reskin to design tokens; pin-to-canvas (button + drag); live-updating pinned cards with provenance; grain/type readability pass.
- **Housekeeping.** Merged to main; private GitHub repo; CLAUDE.md / README / .env.example (in progress).

---

## POC BACKLOG (to reach "POC Done")

### P0 — required for POC done

- [x] **Live model run (real Opus).** Add ANTHROPIC_API_KEY to .env; run the golden path on Haiku first (cheap sanity check on tool-routing), then Opus. Verify: real model picks correct tools per beat; narration stays grounded (no invented numbers); guardrail holds narrate cleanly. Cache the Opus golden path so re-demos are free.
  - *Done when:* the full DEMO_SCRIPT.md golden path runs clean on Opus, every number traces to a tool, both guardrail gates fire correctly.
- [x] **Stage 2b — remaining design-handoff components.**
  - [x] Team × model **attribution heatmap** (alpha-scaled signal/positive fills per the gradient rule).
  - [x] **Drill-down modal** — clicking a heatmap cell opens a table of the underlying rows for that slice.
  - [x] **Forecast-chart refinements** — dashed grey projection switching to signal/negative where it crosses budget; solid budget rule; "today" dot.
  - *Done when:* all three render, match the token spec, and the heatmap→modal drill works.
- [ ] **DEMO_SCRIPT.md current + rehearsed.** Reflects Delta-V rename, unified layout, real-model phrasing variations, and off-script recovery. You can run it top to bottom without hesitation.
  - *Done when:* you can demo the whole thing from the script cold.

### P1 — strongly wanted for a credible POC (fix before showing widely)

- [ ] **Duplicate-message check.** The chat dock showed the same message twice — confirm it's not a double-send bug; fix if it reproduces on a single click.
- [ ] **Golden-path robustness on the real model.** Sensible answers to 3-5 *off-script* questions (not just the four chips), so a curious viewer typing their own question doesn't break the illusion. Graceful "I can only answer about this workload's spend" for out-of-scope questions.
- [ ] **Empty/edge states.** Scrub to day 1-6 (pre-anomaly, pre-baseline warmup) — confirm no errors, sensible "not enough history yet" messaging.
- [ ] **Data-size sanity.** The 9MB event stream loads fine locally; confirm it doesn't make the app feel sluggish. Trim window/volume if needed (it's a config lever).

### P2 — polish (nice before a high-stakes demo, not blocking)

- [ ] Loading/thinking state while the agent works (so a real-model call doesn't look frozen).
- [ ] Streaming responses (deferred in Stage 1 — answers appear complete rather than token-by-token).
- [ ] Mobile/narrow-width behavior (currently desktop ~1440px only) — or an explicit "desktop only" note.
- [ ] Deploy somewhere shareable (a live URL beats "let me screen-share"). Keys stay server-side; needs a host that runs the thin server.

---

## MILESTONE 2 BACKLOG (real-data MVP — captured, not blocking Milestone 1)

*Prioritized. P0 = required for any real pilot user; P1 = required to sell/scale it; P2 = compliance/maturity. Scoped properly when Milestone 2 starts.*

### M2-P0 — the minimum for real data + a real pilot

0. **Data pipeline & storage architecture (market viability — can't promise spend management and fall over at volume).** Real customers emit millions of events/month. Pattern: streaming/near-real-time OTLP collection → micro-batch writes → **columnar OLAP store (ClickHouse is the category de facto; managed ClickHouse Cloud/Tinybird for solo-founder ops)** → incremental hourly/daily aggregates per dimension. Dashboards + anomaly detector query AGGREGATES; raw events kept for drill-down with retention tiers (raw ~30–90 days, aggregates indefinitely). **Architecture inversion note:** the M1 POC computes client-side over a 9MB JSON — at M2 the engine moves server-side and the client queries aggregates; engine *logic* (pure math) survives unchanged, only where it runs moves. **Stress test:** the synthetic generator doubles as the load-test tool — crank config to 10–100x volume and measure before any pilot.
1. **OTLP / OpenTelemetry GenAI ingestion endpoint (primary connector).** Accept OTLP over HTTP; map GenAI semconv attributes (`gen_ai.usage.input_tokens`/`output_tokens`, model, provider, cost) → `UsageEvent`. One endpoint covers: apps instrumented with OTel SDKs, framework auto-instrumentation (Vercel AI SDK, OpenAI Agents SDK, LangChain/LangGraph, LlamaIndex, Claude Agent SDK), AND most gateway exports (LiteLLM etc. emit OTel GenAI spans). This is the center of the ingestion strategy.
2. **CSV/Excel upload connector.** "Upload a dump, map columns to UsageEvent" — the lowest-friction pilot/demo on-ramp; nearly free to build since the schema exists.
3. **Attribution mapping layer + untagged bucket.** Per-connector tag-mapping config (source attribute → feature/team/user/resource_type). Attribution is NOT automatic — tokens/cost/model arrive free; feature/team/user exist only if the customer propagates them as trace attributes. Must degrade gracefully: an explicit "unattributed" bucket so totals always reconcile under partial tagging.
4. **AI-assisted attribution mapping (OOTB feature — differentiator).** On first ingest, Delta-V's own LLM analyzes the raw dump (key names, metadata, endpoint paths, naming patterns) and PROPOSES a feature/team/user mapping; a human confirms before it applies. Propose-and-confirm only — never silently auto-map (a wrong silent mapping corrupts every downstream number; same honest-numbers discipline as the engine). Converts the category's #1 onboarding pain (tagging) into a wizard — and is the flagship self-service feature.
5. **Provider usage-API connectors (reconciliation).** Anthropic + OpenAI usage APIs: coarse (no feature/team/user) but authoritative — used to reconcile telemetry-derived totals against what the provider will actually bill.
6. **Dogfood ingestion.** Delta-V's own reasoning calls flow through its own meter. Cheap, honest, and a demo beat ("it watches itself").
7. **`workload_id` as a first-class schema dimension + agent-fleet views.** Customers run FLEETS of agents (mid-market: several to dozens — support, coding, SDR, copilots; enterprise: dozens to hundreds). Current schema has customer/team/feature but no "which agent" dimension — `feature` is a step within a workload, not the workload. Add `workload_id`, then: **fleet view** (all agents ranked by spend/burn/anomaly status), **per-agent drill-down**, **agent comparison**, and a **workload anatomy view** — the workload's cost *structure*, not just its totals: ordered pipeline steps in execution order (e.g. triage → draft_reply → lookup_order) with per-ticket cost for each step and its model routing, and fixed resources (commitments, subscriptions) shown separately from steps. Nothing in the current UI distinguishes pipeline steps from fixed features or shows execution order; that structure exists only in the generator config. *Note: the schema field itself is cheapest to add NOW (small M1-adjacent generator/schema change) even if the fleet views wait for M2 — avoids a migration.*

### M2-P1 — required to sell and scale

8. **Gateway-specific integrations** where the export isn't OTel-shaped (webhook/log-ship variants): LiteLLM, Helicone, Portkey, OpenRouter, and Lunar.dev (egress "AI control plane" — LLM + MCP + API governance; partially competitor-adjacent on cost visibility, but also an ingestion source whose data arrives pre-tagged with key/user/project). Gateway-sourced data is the best-attributed real data available, since gateways already carry virtual key/user/project.
9. **Cloud billing-export connectors** for compute/infra slices: AWS Cost & Usage Report (S3-delivered, FOCUS format), Azure/GCP equivalents. NOTE: "billing exports" = machine-readable provider cost files, NOT accounting software; QuickBooks etc. is a potential downstream *export target*, never an ingestion source.
10. **RBAC via SSO with role mapping.** SAML/OIDC auth against the customer IdP (Okta, Microsoft Entra ID, Google Workspace cover the vast majority), SCIM for provisioning, and IdP-group → Delta-V-role mapping (e.g., their "Finance Admin" group → admin). Personas to support: FinOps practitioner (investigate/budget, no execute → current FinOps role), Engineering/platform lead (execute within limits → current Eng role), Finance controller (view + budget approval), Exec viewer (read-only rollups), Org admin (manages workspace/connectors/mappings). Per-workspace data scoping (multi-tenancy) and an audit log of all actions.
11. **Real action execution via gateway write-back.** "Cap this workload" executes by writing budget/limit config to the customer's gateway (LiteLLM/Portkey already enforce per-key budgets with automatic cutoff) — a clean, realistic execution path instead of mutating customer infra directly. **Enforcement modes, honestly labeled:** every cap carries an explicit mode — **enforced** (gateway write-back), **delegated** (webhook to customer infra), or **alert-only** (no control surface) — surfaced in the UI. Never imply teeth that don't exist. Gateway integration improves both attribution-in and enforcement-out: one integration, both directions. Architecture note: Delta-V is a control plane, not a data plane — it can never enforce spend limits by itself; enforcement requires a control point in the request path.
12. **Narration honesty gaps from the M1 live run (tracking — none blocking).** Three observed instances of the model narrating beyond what a tool confirmed, logged Jul 9 2026: (1) *Committed/flat under-count* — a "~$2,450 committed/flat" aside omitted the AWS commit, understating the true committed total; likely a summary field missing a term, not a calculation bug. (2) *Derived ratio phrasing* — narration sometimes computes derived ratios (e.g. "14× more expensive per token") from provided figures rather than relaying a precomputed tool value; benign since the arithmetic is correct, but technically the model deriving a number — revisit if the "math for the meter, LLM for the judgment" discipline gets stricter enforcement. (3) *Haiku enforcement-language wobble* — on the Haiku sanity pass the model invented enforcement semantics ("traffic will be throttled…") on the executed-cap beat instead of relaying the simulation note: a live instance of the enforced-vs-alert-only honest-labeling gap tracked in the item above. Worth a system-prompt tightening pass or an explicit test case once that item is built, to confirm the fix closes this specific failure mode.
13. **Budgeting layer (proactive governance — maturity layer 2 of 3).** Per-slice budgets (workload/feature/team), soft thresholds (alert at N%) vs hard caps (enforce), user-settable — persisted policy objects the forecast and detector evaluate continuously, replacing the single hardcoded demo budget. Proactive budgets are the steady state; reactive capping (the current demo) is the emergency brake; agent-recommended actions bridge them. Defaults proposed from baseline data, user confirms — honest defaults extend to policy setup.

14. **User-configurable governance.** Budgets, guardrail limits, and thresholds editable by users — chat-first (guardrailed action tools writing persisted config) with a minimal settings panel fallback. Depends on persistence + RBAC. Changing a guardrail is itself a guardrailed action; configuration changes are audited.

15. **Ingestion + mapping as demo beats.** The Milestone 2 demo/pitch story must include: connect a source → AI proposes the attribution mapping → human confirms → dashboards light up. Onboarding IS part of the pitch.
16. **Generic drill-down for all charts/tables (agent capability).** Generalize the heatmap's drill-down (click cell → underlying-events modal) into a prompt-triggered capability for any chart or table: "build drill-down for Daily Spend" / "add drill-down for LLM Spend" → a modal showing the underlying real events for that slice — keyed by date, dimension, or cell depending on chart type. Architecture: the heatmap version works because each cell already maps to a filtered slice via the shared cost-matrix.ts aggregation; time-series charts need the same event-filtering pattern keyed by date/dimension rather than cell. Likely mostly wiring a generic drill-down tool across chart types rather than rebuilding per-chart, if the filtering logic is factored out cleanly. Consistent with the Stage 2b precedent: every visualization is an agent tool call — this is an agent capability, not a fixed per-chart feature.
17. **Persistence** (layouts/pins survive refresh, per user/workspace) and **model-provider adapter** (swap Delta-V's own reasoning model per customer compliance).
18. **BI/analytics export.** Enterprise finance still lives in Power BI/Tableau/Looker. In order of leverage: (a) scheduled CSV / data-export API (cheap, early) — emit **spec-conformant FOCUS columns** (CSV/Parquet) with `x_`-prefixed extensions for `workload_id`/`customer_id`, ingesting natively into Power BI/Tableau/Looker/Excel with no connector build. Explicitly **not** a certified Power Query connector or OData feed (enterprise-band). Converts the schema bet into a visible feature; (b) **warehouse sync** — push aggregates into the customer's Snowflake/BigQuery/Databricks (the modern enterprise ask: "give me the data in my warehouse"; one integration serves every BI tool at once); (c) native Power BI / Tableau connectors (enterprise-band; not before a paying signal).

### M2-P2 — maturity and compliance

19. **SOC 2.** Certification comes at the end, but build the controls along the way (audit logging, access control, key custody — largely already practiced) so certification is paperwork, not rearchitecture.
20. **Approval workflow / separation of duties.** Guardrail evolves from permission gate to FinOps-approves / Eng-executes with pending states and an approval queue.
21. **Autonomous enforcement (governance maturity layer 3 — the "governor" end-state).** Pre-set policies trigger guardrailed actions automatically: auto-throttle within authority, hold-and-escalate beyond — no human ask in the loop. The same deterministic gate governs reactive, proactive, and autonomous paths — that consistency is the core trust story. Depends on the budgeting layer + user-configurable governance (M2-P1) and honest enforcement-mode labeling; autonomous alert-only actions are the safe first step, enforced actions the last.

22. **MCP server exposure.** Engine tools as a model-agnostic MCP server so any agent (Claude/GPT/Gemini/customer's own) can drive Delta-V — aligns with where OTel GenAI conventions are heading (MCP-server tracing is being standardized). Could pull earlier as a fast-follow if the "bring your own agent" story becomes central.
23. **Embedded/iframe SDK.** Delta-V views embeddable inside a customer's own app (embedded-analytics pattern). Low priority, on the backlog so it isn't lost.
24. **Additional presets/domains.**

### M2 — additional items (added Jul 2026)

25. **Customer hierarchy — cost-to-serve rollup (M2-P1).** Extend the existing customer rollup (DONE: Engine — attribution) with a real-data path: add `x_customer_id` as a FOCUS extension column on `UsageEvent`, populated at ingest from source metadata (LiteLLM key metadata, OpenRouter `user` param), and add workload→customer cost-to-serve and **margin** views to the deterministic engine. Extend the mock generator to emit `x_customer_id` with a skewed customer distribution so rollups produce believable output. Demo-beat candidate: top customer by usage vs. cost-to-serve divergence. Composes with routing economics (DONE) for per-customer margin recovery. Depends on M2 ingestion (relates to items 3, 8). Scope guard: one dimension plus rollup — no hierarchy trees, no chargeback.
26. **LiteLLM adapter integration tests (M2-P1).** Stand up LiteLLM proxy via docker-compose in the test harness. Cover: virtual-key provisioning with workload metadata; usage-event capture via success callback → ingest endpoint → normalized `UsageEvent`, byte-shape asserted against mock-mode fixtures; policy-sync write path (set budget via admin API, assert the ledger reflects it); enforcement fires (drive spend past budget with cheap requests, assert 429 with reason); degradation (gateway unreachable resolves to alert-only, correctly labeled). API-level assertions, no Playwright. Pin the LiteLLM image version. Note: green tests here convert the hard-ceiling claim from architectural to CI-backed. Relates to items 8 and 11.
27. **OpenRouter adapter integration tests (M2-P2).** Requires an OpenRouter management key (separate from inference keys; regular keys 403 on analytics). Cover: provision inference keys per fake workload with distinct `user` values per request; Analytics API pull grouped by `api_key_id`, filtering on model slugs per OpenRouter docs; normalization to `UsageEvent` with key→`workload_id` and `user`→`x_customer_id` mapping; `/generation` enrichment path for request-level detail; poll-based ingestion semantics incl. dedupe on re-poll and the 30-day analytics-window boundary. Alert-only source by design — no enforcement assertions. Live-API test (budget a few dollars of cheap-model tokens); record fixtures for CI replay, re-record manually on schema shift. Relates to item 8.
28. **Virtual tagging — retroactive allocation rules (P2, likely never).** Rule-based reallocation over metadata for sources with dirty or missing attribution. Architecturally unnecessary while ingest-time key mapping (items 3–4) holds. Revisit only if a real engagement presents untaggable historical spend. No design work until then.
29. **Gateway adapter interface formalization (M2-P1 — prerequisite for items 26 and 27).** Define `GatewayAdapter` with two channels: `ingestUsageEvents()` and `syncPolicy()`. Everything downstream speaks FOCUS-flavored `UsageEvent` and is unaware of source. LiteLLM is the reference adapter with both channels; OpenRouter and provider-direct are ingestion-only and stub `syncPolicy()` with an explicit alert-only return. Two working adapters across different ingestion shapes (callback stream vs. poll-based analytics) is the proof the interface is real rather than diagrammatic. Formalizes the "connector layer is the adapter" principle (Ingestion strategy) and underlies item 8.
30. **Landing copy: widen Step 01 to spend sources (post-M2).** Once ingestion ships, "Connect your gateway" understates the product; reword to cover gateway (LiteLLM, Portkey), aggregator (OpenRouter), and provider-direct APIs, while keeping the enforcement-requires-a-gateway scoping explicit. Currently an honest underclaim. Do not widen until the adapters (items 26, 27, 29) work.
31. **deltav-landing deploy model + public web root (pre-launch; marketing gate G5).** Two coupled decisions for the landing repo. (a) Deploy model: git-connected Pages builds vs `wrangler pages deploy` direct upload — currently direct upload only, so `main` and production can drift; nothing guarantees they match. (b) Web root: `wrangler.jsonc` sets `pages_build_output_dir: "."`, so EVERY committed file is publicly served (README.md already is, at /README.md). Options: move site files into a `public/` (or `dist/`) output dir (`functions/` stays at root) so the repo can hold non-public files, vs. keeping the repo as a web root with the hard rule that nothing non-public is ever committed. Lean: keep web root + rule for now (zero churn, no build step, matches ship-as-is constraint); switch to `public/` only if non-public files ever need to be tracked in-repo. The trap is the unexamined middle: internal docs committed into a public web root.

### Cross-cutting design constraint: self-service everything (solo-founder / PLG operating model)

Not a backlog item — a constraint on how EVERY item above gets built. Goal: self-serve onboarding, implementation, and maintenance with no human in the loop, low-cost entry, maximum flexibility.
- **Self-serve signup + connector wizards.** Every connector ships with a guided setup flow; the AI-assisted attribution mapping wizard is the flagship (onboarding needs no human precisely because the product proposes the mapping).
- **Sane defaults everywhere** (already the engine's discipline — honest generic defaults extend to setup).
- **Automated ingestion health.** Monitoring that alerts the CUSTOMER (not the founder) when their pipeline breaks or tags degrade — self-healing where possible.
- **The chat agent doubles as onboarding + support.** "Help me connect my data" / "why is this unattributed?" are just conversations with tools — a genuinely differentiated self-service story.
- **Docs + in-app guidance** as first-class deliverables; usage-based low-cost entry pricing so trying it requires no sales conversation.

### Ingestion strategy — the one-paragraph version

The ecosystem converged on OTel GenAI semconv over OTLP as the emit standard; gateways (LiteLLM, Helicone, Portkey, Lunar.dev) sit in the request path and mostly also export OTel. So: ONE OTLP endpoint (P0) covers most of the agentic ecosystem; CSV upload (P0) covers pilots; provider usage APIs (P0) reconcile; gateway-specific + cloud billing connectors (P1) fill the gaps. Every method normalizes into the single `UsageEvent` schema — the connector layer is the adapter, the engine never changes. Attribution richness depends on customer tagging; the AI-assisted mapping wizard (P0) is how onboarding makes that painless, and the untagged bucket is how honesty survives partial tagging. Frameworks (Vercel AI SDK, OpenAI Agents SDK, LangChain/LangGraph, LlamaIndex, Claude Agent SDK) are *sources* that emit into the OTLP path, not separate parsers. A Delta-V-native SDK (direct `UsageEvent` emit with rich tags) remains optional — highest fidelity, highest customer effort; OTLP + gateways cover most needs.

---

## Session additions — Jul 15 2026 (demo-prep, cost, features, strategy)

### Demo-prep blockers (needed before the William/Wade real-mode demo)

32. **Mode visibility + safety.** Add a UI mode badge (REAL/MOCK, sourced from a
    server field) so the running mode is never ambiguous; add a `reason:mock` npm
    script for free deterministic rehearsal; restart discipline — kill stale
    servers before a run. Root cause: the July 14 false cold run happened on a
    stale real-mode server with the mode invisible.
33. **Rotate the DeltaV API key before real-mode prep** — the current key expires
    July 16, 2026.

### Cost optimization (real, cheap — do before or during real-mode prep)

34. **Enable prompt caching on the system prompt + tool definitions.** Diagnosis
    showed input tokens dominate cost and caching is underused; the biggest
    lever, and free to turn on.
35. **Default narration to a Haiku-class model.** Reserve frontier only where
    narration quality demonstrably needs it. The engine does the reasoning; the
    model only phrases. Also a dogfooding story.

### Product feature ideas (post-demo, design-stage — not now)

36. **Data mode as a product feature.** Separate LLM mode (real vs scripted
    narration — internal) from data mode (connected-gateway data vs seeded
    sample data — user-facing). Offer a labeled "sample data" mode so prospects
    explore a working Delta-V before connecting a gateway. Serves the self-serve
    funnel and the trust barrier. Keep the labeling explicit.
37. **Bring-your-own-model for narration.** Let customers route narration through
    their own model/endpoint. Primary value is deployment flexibility and
    data-boundary/compliance, not cost (narration is already cheap). Risk:
    narration quality depends on the chosen model — needs a quality floor or
    explicit labeling. Enforcement stays model-independent. Distinct from the
    MCP surface (item 22 = bring your own assistant).

### Content (post-demo)

38. **Dogfood piece: "What Delta-V cost to build, and what Delta-V told me to fix
    about it."** The Console usage dashboard (input-dominated, caching
    underused, frontier model on a light task) is the artifact — Delta-V's own
    advice applied to Delta-V. Gated on M2 ingestion.

### Strategy notes (recorded for interview-answer value — not build items)

39. **Target segment.** Segment by inference spend and gateway-capability, not
    company size. Fit is ~$10K–200K/month LLM spend, running or willing to run a
    gateway (so enforcement applies). Spans mid-market and dev-heavy startups;
    excludes generic SMB (too little spend, can't use enforcement, reaches for
    free Langfuse+LiteLLM) and enterprise (procurement, SOC2, above solo reach).
40. **Deployment model.** Default is self-hosted whole-app in the customer's
    environment (Docker/Helm) for the gateway-capable target — engine, event
    store, UI, narration all on their infra/keys; spend data never leaves their
    boundary. Near-zero COGS, removes the data-trust barrier, consistent with
    the local-first thesis and with customers already self-hosting a gateway.
    "Just host the LLM" is a non-option — the sensitive asset is the data, not
    the model.
41. **COGS/pricing.** Near-zero COGS because it's a control plane, not an
    inference product (customer's tokens on customer's key). Decouples price
    from cost. Likely pricing: tiered on governed spend with feature gates for
    higher tiers. Narration COGS small and controllable (Haiku + caching, est.
    $8–15/customer/mo). Revisit the earlier "reject hosted multi-tenant" note:
    that was scoped to a COGS fear this analysis doesn't support — keep
    rejecting premature hosted (billing infra, SOC2, hosting before demand),
    not hosted as an architecture.

### Housekeeping

42. **Set up Delta-V domain email + fix git author identity (low priority,
    post-demo).** Create a Cloudflare Email Routing alias on deltav.info (e.g.
    saagar@deltav.info) forwarding to the primary inbox — free, receive-only by
    default. Use it as the git author email for the delta-v and deltav-landing
    repos so commits aren't attributed to the driftaudiohelp@gmail.com Drift
    Audio support alias (matters if either repo goes public or is shown as a
    portfolio piece). If a real sendable mailbox is needed later for outreach,
    upgrade to Zoho free tier or Google Workspace. Cosmetic until a repo is
    shown publicly.

---

## Guardrails on how we build (carried from the whole build — do not violate)

- **Math for the meter, LLM for the judgment.** Engine computes numbers; the model narrates and decides. The model never re-derives a figure a tool can provide.
- **Honest defaults, never demo-tuned.** Thresholds, budgets, anomaly sizes are generic, defensible defaults. Never reverse-engineered to force a red gauge or a specific outcome.
- **Keys server-side, never committed.** API keys live in .env (gitignored) and are used only by the thin server. Never in the frontend, never in git.
- **Deterministic guardrail.** Policy decisions are code, not model judgment. The model narrates the verdict it's handed.
- **Sequence, don't pile up.** Bank a working, committed checkpoint before starting the next big block. Branch for risky reworks.

---

## Rejected / out of scope (recorded so they stay rejected)

- **Chargeback** — enterprise finance process, out of scope. (Item 25's scope guard reinforces this: cost-to-serve rollup, no chargeback.)
- **Glean marketplace plugin** — no data-plane access, wrong buyer, wrong motion.
- **Billing / hosted multi-tenant / pricing page** — venture-track spend, not job-leverage or consulting track.
