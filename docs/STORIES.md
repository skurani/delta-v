# Delta-V — Working backlog (stories)

PM-shaped work items for Cursor. `BACKLOG.md` stays the design dump and
definition of done. **This file is what you groom and ship.**

**Current milestone:** M2 (real-data MVP). M1 is banked; leftover M1 stories
are demo close-out, not product expansion.

**How to work it in Cursor**

1. Open the [M1/M2 board](/Users/skurnai/.cursor/projects/Users-skurnai-deltav-landing/canvases/m1-m2-backlog.canvas.tsx) beside chat, or `@docs/STORIES.md`.
2. Prompt: `Work the next Now story` or `Work story M2-S3`.
3. Agent reads this file, honors Assumptions, implements, then updates
   Status here and the matching checkbox in `BACKLOG.md`.
4. One story per branch/session. Do not start the next Now item until
   the current one is `Done` or explicitly parked.

Status: `Todo` · `In Progress` · `Done` · `Parked`

---

## Cross-cutting assumptions (every story)

These are product constraints, not stories. Violate none of them.

- **Math for the meter, LLM for the judgment.** Engine computes; model narrates and picks tools. Never let the model invent a figure a tool can return.
- **Honest defaults.** Thresholds, budgets, anomaly sizes stay independently justified. Never tune inputs to make a demo look good.
- **Same engine, both sides.** Server and client import the same math modules. M2 moves *where* the engine runs, not the formulas.
- **Control plane, not data plane.** Delta-V cannot enforce spend by itself. Caps are `enforced` (gateway write-back), `delegated` (customer webhook), or `alert-only`. Label the mode. Never imply teeth that do not exist.
- **Attribution is not automatic.** Tokens/cost/model arrive free. Feature/team/user exist only if the customer tags them. Partial tagging → explicit `unattributed` bucket so totals still reconcile. Propose-and-confirm mapping; never silent auto-map.
- **Self-serve.** Every connector ships with a guided path. The agent is onboarding and support, not a human in the loop.
- **Out of scope until a paying signal:** chargeback, hosted multi-tenant billing, Glean marketplace, SOC 2 as a project (build controls along the way).

---

## Now — recommended sequence

Do in this order. M2-S0 is sliced so we do not wait on ClickHouse to prove ingest.

| ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M2-S0 | Server-side engine + event store (thin slice) | P0 | Todo |
| M2-S1 | Finish GatewayAdapter seam | P0 | In Progress (types + stub exist) |
| M2-S2 | Productize attribution mapping + unattributed | P0 | In Progress (helper exists) |
| M2-S3 | CSV / Excel upload connector | P0 | Todo |
| M1-S5 | Data-size sanity on the 9MB stream | P1 | Todo |

---

## M1 — Demo close-out

M1 finish line (banked): first-time viewer watches the golden path end-to-end;
every number traces to the engine; both guardrail gates fire; it looks like a
product. Remaining work is credibility before a high-stakes demo, not M2
blockers.

### M1-S1 — Rehearse the golden path cold

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 leftover — do before the next live demo |
| Horizon | Later unless a demo is booked |
| Source | BACKLOG POC P0 |

**Story.** As the person demoing Delta-V, I can run `DEMO_SCRIPT.md` top to
bottom without hesitation, including rename/layout phrasing and off-script
recovery.

**Assumptions**

- Live Opus golden path already ran and is cacheable.
- The script may still say pre-rebrand / pre-unified-layout things.
- Rehearsal is a human task; code only if the script is wrong.

**Acceptance**

- [ ] `DEMO_SCRIPT.md` matches current UI, role labels, and real-model wording.
- [ ] One cold run completes without dead ends.
- [ ] Off-script recovery line is written down.

### M1-S2 — Single-send does not duplicate the chat message

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG POC P1 |

**Story.** As a viewer, I click send once and see one user bubble and one
agent reply.

**Assumptions**

- Bug was observed once; may be React Strict Mode, chip double-bind, or a
  history-echo issue. Confirm before changing architecture.

**Acceptance**

- [ ] Reproduced or ruled out on a single click in mock and real mode.
- [ ] If real, one send = one pair of messages after refresh.

### M1-S3 — Off-script questions stay grounded

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG POC P1 |

**Story.** As a curious viewer, I type my own spend question (not a chip)
and get a tool-grounded answer, or a clear "I only answer about this
workload's spend."

**Assumptions**

- Mock mode is golden-path only by design; this story is **real-model**.
- Do not widen the product to general Q&A.

**Acceptance**

- [ ] 3–5 off-script spend questions get sensible, tool-traced answers.
- [ ] Out-of-scope questions get a graceful refusal.
- [ ] No invented figures.

### M1-S4 — Early-window empty states

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG POC P1 |

**Story.** As a user, I scrub to day 1–6 (pre-anomaly, pre-baseline warmup)
and see "not enough history yet," not a crash or a fake anomaly.

**Assumptions**

- Detector correctly refuses to fire without a trailing window; UI may not
  say so.
- Honest empty is better than a placeholder chart that looks like zero spend.

**Acceptance**

- [ ] Days 1–6 render without errors.
- [ ] Forecast / anomaly cards explain missing baseline.
- [ ] No lookahead (day N judged only on days before it).

### M1-S5 — Data-size sanity

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Now (feeds M2-S0) |
| Source | BACKLOG POC P1 |

**Story.** As a user of the current synthetic stream (~9MB JSON, client-side
engine), the UI stays responsive enough to demo.

**Assumptions**

- Volume is a config lever in the generator; do not trim if it is already fine.
- If it is sluggish, that is evidence for M2-S0 — do not paper over it by
  shrinking the demo until the story is recorded.

**Acceptance**

- [ ] Timed load + scrub + pin on the current file.
- [ ] Either "fine as-is" with numbers written here, or a trim / M2-S0 note.

### M1-S6 — REAL / MOCK mode is visible

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG #32 |

**Story.** As a demo operator, I can see whether the running server is REAL
or MOCK without guessing.

**Assumptions**

- July 14 false cold run was a stale real-mode server with no badge.
- Badge is sourced from a server field, not a client env guess.

**Acceptance**

- [ ] UI badge matches the process that is actually serving `/api`.
- [ ] `reason:mock` script exists for rehearsal.
- [ ] Stale-server restart note is in the run docs.

### M1-S7 — Agent thinking state

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P2 |
| Horizon | Later |
| Source | BACKLOG POC P2 |

**Story.** As a viewer, I see that the agent is working during a real-model
round-trip so the dock does not look frozen.

**Assumptions**

- Streaming (M1-S8) is a separate story. This is a busy/thinking indicator.

**Acceptance**

- [ ] Visible in-progress state from send until first complete reply.

### M1-S8 — Stream tokens

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P2 |
| Horizon | Later |
| Source | BACKLOG POC P2 |

**Story.** As a viewer, I see the reply appear token-by-token instead of
all at once.

**Assumptions**

- Deferred in Stage 1 on purpose. Do not start unless a demo needs it.

**Acceptance**

- [ ] Chat streams; tool-call chrome stays readable; numbers still come
  from tools, not the stream.

### M1-S9 — Desktop-only is explicit, or narrow width works

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P2 |
| Horizon | Later |
| Source | BACKLOG POC P2 |

**Story.** As someone opening the app below ~1440px, I either get a usable
layout or a clear "desktop only" message.

**Assumptions**

- Product is designed at ~1440. A note is cheaper than a mobile redesign.
- Landing site is a different repo and not this story.

**Acceptance**

- [ ] One of: desktop-only note, or a non-broken narrow layout for the
  golden-path screen.

### M1-S10 — Shareable deploy

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P2 |
| Horizon | Later |
| Source | BACKLOG POC P2 |

**Story.** As a remote viewer, I can open a URL instead of a screen share.

**Assumptions**

- Key stays server-side. Host must run the thin reason server.
- Not a multi-tenant product. One demo instance is enough.
- Do not start hosted billing / auth as part of this.

**Acceptance**

- [ ] One live URL runs the golden path.
- [ ] Keys are not in the frontend or the repo.

### M1-S11 — Prompt cache the system prompt + tools

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P2 (cheap, do whenever) |
| Horizon | Next |
| Source | BACKLOG #34 |

**Story.** As the person paying for real-mode demos, I want input tokens
cached so re-runs are cheap.

**Assumptions**

- Diagnosis already showed input-dominated cost and underused caching.
- Caching is a server/API flag, not a product feature.

**Acceptance**

- [ ] System prompt + tool definitions are cache-marked.
- [ ] A re-run shows cache hits in usage, not a full input bill.

### M1-S12 — Default narration to a Haiku-class model

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P2 |
| Horizon | Later |
| Source | BACKLOG #35 |

**Story.** As the operator, narration defaults to a cheap model; frontier
is reserved for cases that demonstrably need it.

**Assumptions**

- Engine does the reasoning; the model only phrases.
- Quality floor: golden-path narration must stay grounded. If Haiku invents
  enforcement language (known M1 gap), keep frontier for those beats or
  tighten the prompt first (ties to M2-S10).

**Acceptance**

- [ ] Default model is documented and switchable.
- [ ] Golden path still traces every number to a tool.

---

## M2 — Real-data MVP (current)

Done when real usage can flow through the same engine, attribution degrades
honestly when tags are missing, and a first pilot has one working ingest
path — not a full platform.

### M2-S0 — Server-side engine + event store (thin slice)

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Now |
| Source | BACKLOG #0 (first slice, not ClickHouse-complete) |

**Story.** As a future pilot, my events are stored and queried on the
server so the browser is not the warehouse.

**Assumptions**

- M1 computes the engine client-side over `data/usage-events.json`. That
  inversion is the M2 architecture change.
- **Do not start with managed ClickHouse.** First slice: server owns events
  + runs the same engine; client asks for aggregates / views. Columnar OLAP
  (ClickHouse Cloud / Tinybird) is the *scale* follow-on, not the first PR.
- Engine modules stay pure math. Only the caller moves.
- Synthetic generator is the load-test tool (10–100× config), not production
  data.
- Self-hosted whole-app is the intended deploy shape; do not invent hosted
  multi-tenant infra here.

**Acceptance**

- [ ] Client no longer *requires* the full JSON in-browser to render the
  current dashboard (or a documented interim: server meters, client still
  hydrates — called out honestly).
- [ ] Engine functions are invoked from the server against stored events.
- [ ] Written decision: next store (files / SQLite / CH) and why.
- [ ] Retention idea recorded (raw 30–90d, aggregates keep) even if not
  implemented.

### M2-S1 — Finish GatewayAdapter seam

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P0 |
| Horizon | Now |
| Source | BACKLOG #29 |

**Story.** As an engineer adding a connector, I implement `GatewayAdapter`
only. Downstream speaks `UsageEvent` and never imports a vendor SDK.

**Assumptions**

- `server/gateway/types.ts`, `stub.ts`, and `attribution.ts` already exist.
- Two ingestion shapes are first-class: **push** (LiteLLM callbacks) and
  **poll** (OpenRouter analytics). Transport lives in the harness;
  normalization lives in the adapter.
- LiteLLM is the reference adapter (ingest + `syncPolicy`). OpenRouter and
  provider-direct are ingest-only and must stub `syncPolicy` as `alert-only`.
- This story is "seam is real," not "LiteLLM works in CI" (that is M2-S9).

**Acceptance**

- [ ] Interface covers `ingestUsageEvents` + `syncPolicy` with enforcement
  mode on the result.
- [ ] Stub still compiles and exercises poll + alert-only.
- [ ] One sentence in CLAUDE.md / HANDOFF: engine never imports
  `server/gateway/`.
- [ ] No adapter redefines `UsageEvent`.

### M2-S2 — Productize attribution mapping + unattributed

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P0 |
| Horizon | Now |
| Source | BACKLOG #3 |

**Story.** As a customer with partial tags, every dollar still lands
somewhere: mapped feature/team/user/workload, or the explicit
`unattributed` bucket.

**Assumptions**

- `applyAttributionMapping` exists. Missing piece is **per-connector
  persisted config** + using it on every ingest.
- `user_id: null` already means autonomous run — that is not unattributed.
- Mapping is customer config, not inferred magic. AI proposal is M2-S5.

**Acceptance**

- [ ] A connector can declare source-attr → `workload_id` / `feature` /
  `team_id` / `customer_id` / `user_id`.
- [ ] Unmapped or blank values go to `unattributed` (except `user_id`).
- [ ] Attribution rollups still sum to 100% under partial tagging.
- [ ] Totals match a fixture with mixed tagged / untagged rows.

### M2-S3 — CSV / Excel upload connector

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Now |
| Source | BACKLOG #2 |

**Story.** As a pilot user, I upload a dump, map columns to `UsageEvent`,
and the existing dashboard lights up. No gateway required.

**Assumptions**

- Lowest-friction real-data path. Schema is the emit contract.
- This is the first *user-visible* ingest. Do it after S1/S2 so we do not
  hard-code a second mapping system.
- Excel is in scope if cheap (xlsx → rows); otherwise CSV first is enough
  if the UI says so.
- Sample-data mode (BACKLOG #36) is a later productization of this loop.

**Acceptance**

- [ ] Upload a file, map columns, ingest, see meter + attribution.
- [ ] Bad rows are dropped with reasons; good rows still load.
- [ ] Mapping is confirmable (M2-S2), not guessed silently.
- [ ] Re-upload does not silently double-count (dedupe rule documented).

### M2-S4 — OTLP / OpenTelemetry GenAI ingest

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Now (after S3 proves the loop) |
| Source | BACKLOG #1 |

**Story.** As an app or gateway already emitting OTel GenAI spans, I POST
OTLP/HTTP and Delta-V stores `UsageEvent`s.

**Assumptions**

- One endpoint covers SDK-instrumented apps, framework auto-instrumentation
  (Vercel AI SDK, OpenAI Agents, LangChain, LlamaIndex, Claude Agent SDK),
  and most gateway OTel exports. Do **not** build a parser per framework.
- Map `gen_ai.usage.input_tokens` / `output_tokens`, model, provider, cost
  → `UsageEvent`. Missing cost is allowed if tokens + a rate table can
  price it — say so if you do that.
- Native Delta-V SDK is optional and out of this story.

**Acceptance**

- [ ] OTLP/HTTP endpoint accepts a GenAI span batch.
- [ ] Mapped events persist and appear in the engine views.
- [ ] Attribution uses M2-S2 mapping; untagged → `unattributed`.
- [ ] A recorded fixture (one LiteLLM- or SDK-shaped export) round-trips.

### M2-S5 — AI-assisted mapping wizard

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Next |
| Source | BACKLOG #4 |

**Story.** As a first-time connector user, Delta-V proposes
feature/team/user/workload mappings from the raw dump; I confirm before
anything applies.

**Assumptions**

- This is the flagship self-serve feature and the M2 demo beat (with S3/S4).
- Propose-and-confirm only. A wrong silent map corrupts every number.
- LLM may suggest; it must not write the mapping without a human accept.
- Works on CSV first; OTLP metadata second.

**Acceptance**

- [ ] First ingest shows a proposed mapping with evidence (key names,
  sample values).
- [ ] Confirm writes M2-S2 config; reject leaves data unattributed.
- [ ] Re-running the wizard does not overwrite without confirm.

### M2-S6 — Provider usage-API reconciliation

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Next |
| Source | BACKLOG #5 |

**Story.** As a FinOps user, I can compare telemetry-derived totals to
what Anthropic / OpenAI will actually bill.

**Assumptions**

- Provider APIs are coarse (no feature/team/user) and **authoritative for
  dollars**, not a replacement for tagged telemetry.
- Reconciliation is a variance view, not a silent overwrite of attributed
  spend.
- Start with one provider if both are expensive to certify.

**Acceptance**

- [ ] Pull usage for a window; show telemetry total vs billed total.
- [ ] Variance is explained as "unattributed / missing / timing," not
  hidden.
- [ ] Keys stay server-side.

### M2-S7 — Dogfood: Delta-V meters itself

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Next |
| Source | BACKLOG #6, #38 |

**Story.** As a demo viewer, I can see Delta-V's own reasoning calls in
the same meter.

**Assumptions**

- Cheap and honest. Gated on a working ingest path (S3 or S4).
- The "what it cost to build / what it told me to fix" write-up is
  content, not this story.

**Acceptance**

- [ ] Reason-server calls emit `UsageEvent`s (OTLP or direct).
- [ ] They appear as a distinct workload, not mixed into the synthetic
  customer-support preset unless labeled.

### M2-S8 — Fleet + workload anatomy views

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P0 |
| Horizon | Next |
| Source | BACKLOG #7 |

**Story.** As a platform lead running several agents, I can rank
workloads by spend/burn/anomaly and open one agent's cost structure
(pipeline steps vs fixed resources).

**Assumptions**

- `workload_id` is already on the schema and generator. This story is
  **views**, not the column.
- `feature` is a step inside a workload, not the workload.
- Execution order exists in generator config today; the UI does not show
  it.
- Visualizations stay agent-tool-shaped (heatmap precedent), not a new
  fixed dashboard island.

**Acceptance**

- [ ] Fleet list: workloads ranked by spend and anomaly status.
- [ ] Per-workload drill: steps in order + model routing + per-ticket
  cost where the data has it.
- [ ] Fixed/committed resources shown separately from steps.
- [ ] Comparison of two workloads without inventing numbers.

### M2-S9 — LiteLLM adapter + honest enforcement

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG #8, #11, #26 |

**Story.** As a customer already on LiteLLM, I connect it and "cap this
workload" writes a budget to the gateway — or the UI says alert-only if
it cannot.

**Assumptions**

- LiteLLM is the reference two-channel adapter.
- Enforcement requires a control point in the request path. Without it,
  mode is `alert-only`.
- Integration tests (docker-compose, pinned image, API-level, no
  Playwright) are part of done, not a follow-up.
- OpenRouter is a later ingest-only adapter (Parked as M2-S14).

**Acceptance**

- [ ] Success-callback (or equivalent) → normalized `UsageEvent`.
- [ ] `syncPolicy` sets a budget; spend past it returns 429 with reason
  in the test harness.
- [ ] Gateway down → `alert-only`, labeled in the product.
- [ ] UI never says "throttled" unless mode is `enforced`.

### M2-S10 — Per-slice budgets + user-editable governance

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG #13, #14 |

**Story.** As a FinOps or Eng user, I set per-workload / feature / team
budgets and guardrail limits; the forecast and detector evaluate those
objects instead of the single demo `$3,000`.

**Assumptions**

- Today's reactive cap is the emergency brake. Budgets are the steady
  state.
- Defaults are proposed from baseline data; user confirms (honest
  defaults extend to policy).
- Chat-first writes; a tiny settings panel is fallback.
- Changing a guardrail is itself a guardrailed, audited action.
- Depends on persistence. Full SSO/RBAC is M2-S12 — until then, the
  existing FinOps/Eng toggle is the gate.

**Acceptance**

- [ ] More than one persisted budget exists and forecast uses them.
- [ ] Soft threshold (alert at N%) vs hard cap (enforce) is stored and
  labeled.
- [ ] Member role still cannot execute; impact gate still holds > $50
  (or the configured authority).

### M2-S11 — Ingestion + mapping is a demo beat

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Next |
| Source | BACKLOG #15 |

**Story.** As a prospect, the M2 pitch includes: connect a source → AI
proposes mapping → I confirm → dashboards light up.

**Assumptions**

- Onboarding is the pitch, not a setup tax.
- Blocked on S3 + S5. Do not write a slide-only script first.

**Acceptance**

- [ ] `DEMO_SCRIPT.md` (or an M2 script) has this beat with honest
  numbers from the upload just performed.

### M2-S12 — Persistence + scoped auth (pilot minimum)

| Field | Value |
| --- | --- |
| Status | Todo |
| Priority | P1 |
| Horizon | Later (scope when a real pilot needs it) |
| Source | BACKLOG #10, #17 |

**Story.** As a returning pilot user, my pins/layout and connector
config survive refresh, and I only see my workspace.

**Assumptions**

- Do not build Okta/SCIM until a named pilot asks. First slice:
  persisted workspace + the existing two roles.
- Model-provider adapter (swap narration model) is a separate, later
  cut of #17.

**Acceptance**

- [ ] Pins and mappings persist per workspace.
- [ ] Two roles still map to the current guardrail.
- [ ] No claim of SSO until it exists.

---

## Later / Parked

Not Now. Keep so they are not re-litigated. Pull only with a written why.

| ID | Story | Why parked |
| --- | --- | --- |
| M2-S13 | Cloud billing exports (AWS CUR / FOCUS) | P1 after a gateway path works. Billing files ≠ QuickBooks. |
| M2-S14 | OpenRouter adapter + live tests | Ingest-only, alert-only, needs a management key. After LiteLLM. |
| M2-S15 | Generic drill-down for every chart | Agent capability; heatmap already has the pattern. |
| M2-S16 | FOCUS CSV / warehouse export | Convert the schema bet into a feature once ingest is real. |
| M2-S17 | Cost-to-serve / margin by customer | One dimension + rollup; no chargeback. Needs ingest + `x_customer_id`. |
| M2-S18 | Approval workflow | Guardrail becomes a queue. Planned evolution, not M2-P0. |
| M2-S19 | Autonomous enforcement | Governance layer 3. Needs S10 + honest modes. Alert-only first. |
| M2-S20 | MCP server for engine tools | Fast-follow if "bring your own agent" becomes the story. |
| M2-S21 | Embedded iframe SDK | Low leverage until someone asks to embed. |
| M2-S22 | Virtual tagging / retroactive rules | Likely never; ingest-time mapping should hold. |
| M2-S23 | Landing copy: widen Step 01 | After adapters work. Honest underclaim until then. |
| M2-S24 | Landing deploy model + web-root rule | Marketing gate in `deltav-landing`, not the app. |
| M2-S25 | Sample-data vs connected-data mode | Productize S3's loop for prospects. |
| M2-S26 | BYO narration model | Compliance flexibility, not cost. Distinct from MCP. |
| M2-S27 | Domain email + git author | Cosmetic until a repo is shown publicly. |
| M1-S8–S10 | Streaming, mobile, public demo URL | P2 demo polish. |

**Rejected (stay rejected):** chargeback · Glean marketplace · hosted
billing / pricing page as a build.

---

## Grooming rules

When a story finishes: set Status to `Done`, check the source item in
`BACKLOG.md`, and move the next Now row to `In Progress` only when you
start it.

When scope changes: edit this file. Do not add a parallel list in chat
or HANDOFF. HANDOFF may point here; it is not the backlog.
