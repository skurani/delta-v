# Delta-V — Product Stories (PM backlog)

**Audience:** product decisions + agent work intake.  
**Companion:** `BACKLOG.md` stays the detailed technical/architecture backlog. This file is the **prioritized story layer** — what a PM would groom, sequence, and hand to builders (including Cursor agents).

**How to use this file as the Cursor backlog:** see [§ Working this backlog in Cursor](#working-this-backlog-in-cursor) at the bottom.

---

## Priority legend

| Priority | Meaning |
|---|---|
| **P0** | Must ship for the milestone finish line |
| **P1** | Strongly wanted before showing / piloting widely |
| **P2** | Nice / maturity — do after P0–P1 |
| **Parked** | Captured, not scheduled |

**Status:** `Todo` · `In progress` · `Done` · `Blocked`

---

# Milestone 1 — Demoable POC (synthetic data)

**Outcome:** A cold viewer can run the golden path end-to-end; every number is engine-backed; both guardrail gates are visible; it looks like a product.

**Milestone assumptions (shared)**
- Synthetic generator + seeded presets remain the only data path for M1.
- Demo audience is interview / portfolio / warm intro — not a paying pilot yet.
- Mock mode is the rehearsal path; real Opus is the credibility check.
- Honest defaults stay — never retune thresholds to force a demo beat.

### What’s already Done (do not re-open)

Engine (meter / attribute / anomaly / forecast / routing), agent loop + guardrail, mock mode, Stage 2a UI, Stage 2b heatmap/drill/forecast polish, live Opus golden-path verification (per BACKLOG).

---

## Epic M1-E1 — Demo reliability

### M1-S1 — Rehearse and freeze DEMO_SCRIPT.md
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG POC P0
- **Story:** As the presenter, I can run DEMO_SCRIPT.md cold (mock or cached Opus) without hesitation so the five-beat story always lands.
- **Assumptions:**
  - Script already mostly matches Delta-V rename + unified layout; remaining work is rehearsal + phrasing/off-script notes, not a rewrite.
  - Numbers may drift slightly after `npm run generate`; shape of beats is stable.
  - Mock phrasing brittleness (e.g. “heat map” vs “heatmap”) is acceptable; real Opus is authoritative.
- **Acceptance:**
  - Script reflects current UI labels, chips, and guardrail narration.
  - Includes off-script recovery lines.
  - You can complete the full path once in mock and once from cache without improvising structure.

### M1-S2 — Golden-path off-script robustness (real model)
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG POC P1
- **Story:** As a curious viewer, I can type 3–5 questions outside the four chips and still get grounded, in-scope answers (or a clean decline).
- **Assumptions:**
  - System prompt already scopes to this workload’s spend; we validate, not invent a new product surface.
  - Out-of-scope → one-sentence decline + offer of what Delta-V can do.
- **Acceptance:**
  - Documented list of 3–5 off-script prompts with expected tool/no-tool behavior.
  - No invented dollar figures on those runs.

### M1-S3 — Duplicate chat message investigation
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG POC P1
- **Story:** As a user, a single send never shows the same message twice.
- **Assumptions:** May be a one-off / StrictMode / double-handler; fix only if reproducible on single click.
- **Acceptance:** Repro steps recorded; fixed if reproducible; otherwise marked WONTFIX with evidence.

### M1-S4 — Empty / early-window edge states
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG POC P1
- **Story:** As a FinOps user scrubbing to day 1–6, I see sensible “not enough history” messaging, not errors or blank crashes.
- **Assumptions:** Detector warmup and pre-anomaly window are intentional; messaging > fake anomalies.
- **Acceptance:** Scrub days 1–6; no console/UI exceptions; charts/tools degrade honestly.

### M1-S5 — Data-size / load sanity
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG POC P1
- **Story:** As a demo host, the ~9MB event stream does not make the app feel sluggish on a typical laptop.
- **Assumptions:** Volume is a config lever; trim only if perceived lag is real.
- **Acceptance:** Note pass/fail after cold load + scrub + pin; trim config only if fail.

---

## Epic M1-E2 — Demo polish

### M1-S6 — Agent loading / thinking state
- **Priority:** P2 · **Status:** Todo
- **Story:** As a user waiting on a real-model call, I see a clear in-progress state so the UI never looks frozen.
- **Assumptions:** Full token streaming can stay deferred; a thinking/spinner is enough for M1.
- **Acceptance:** Visible state from request start until first content/tool card.

### M1-S7 — Streaming responses
- **Priority:** P2 · **Status:** Todo · **Park after M1 if timeboxed**
- **Story:** As a user, answers appear incrementally rather than all-at-once.
- **Assumptions:** Deferred in Stage 1 by design; not required to call M1 done.
- **Acceptance:** Streamed text for final narration; tool cards still appear as complete units.

### M1-S8 — Mobile / “desktop only” honesty
- **Priority:** P2 · **Status:** Todo
- **Story:** As a viewer on a narrow screen, I either get a usable layout or an explicit desktop-only note.
- **Assumptions:** Target remains ~1440px desktop for demos; full responsive is not M1 scope.
- **Acceptance:** Either narrow layout doesn’t break primary flow, or UI states desktop-only.

### M1-S9 — Shareable deploy
- **Priority:** P2 · **Status:** Todo
- **Story:** As a stakeholder, I can open a live URL instead of a screen share.
- **Assumptions:** API keys stay server-side; host must run the thin reason server; mock mode acceptable for public link if labeled.
- **Acceptance:** Documented deploy + URL; mode badge visible; no keys in frontend.

---

## Epic M1-E3 — Demo-prep / cost hygiene (session add-ons)

### M1-S10 — Mode visibility + mock script safety
- **Priority:** P0 (before any real-mode demo) · **Status:** Done (BACKLOG 32)
- **Story:** As a presenter, I always know REAL vs MOCK and can rehearse free via `reason:mock`.

### M1-S11 — Prompt caching + cheaper narration default
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 34–35
- **Story:** As the builder, narration COGS stay low (cache system+tools; Haiku-class default unless quality forces frontier).
- **Assumptions:** Engine does the reasoning; model only phrases. Quality floor checked on golden path before flipping default.
- **Acceptance:** Caching enabled where supported; cost note recorded; golden path still grounded.

### M1-S12 — Rotate API key / domain email identity
- **Priority:** P2 / housekeeping · **Status:** Todo · **Maps to:** BACKLOG 33, 42
- **Assumptions:** Not product scope; do before public/portfolio showings.

---

# Milestone 2 — Real-data MVP (pilot path)

**Outcome:** Real usage can flow through the same engine; attribution degrades honestly when tags are missing; at least one path can enforce via a gateway (or is explicitly alert-only).

**Milestone assumptions (shared)**
- Engine math stays pure and shared; only *where* it runs and *how events arrive* change.
- Delta-V is a **control plane**, not a data plane — hard enforcement requires a gateway (or customer webhook). Never imply teeth that don’t exist.
- Attribution richness is not free: tokens/cost/model arrive easily; feature/team/user only if the customer tags (or maps) them.
- Self-serve / PLG constraint: connectors + mapping wizard over services-heavy onboarding.
- Target segment: ~$10K–200K/mo LLM spend, gateway-capable (BACKLOG 39). Self-hosted default (BACKLOG 40).

---

## Epic M2-E1 — Ingest & normalize (foundation)

*Order matters: seam → LiteLLM reference → storage → OTLP/CSV → mapping wizard.*

### M2-S1 — GatewayAdapter seam + LiteLLM reference adapter
- **Priority:** P0 · **Status:** Done (interface + stub on main; LiteLLM adapter on PR #1 / BACKLOG 29)
- **Story:** As a platform builder, every gateway speaks `ingestUsageEvents` + `syncPolicy` into FOCUS `UsageEvent` / honest enforcement modes.
- **Assumptions:** Push (LiteLLM) and poll (OpenRouter later) are both first-class; silent empty ingest / silent policy no-op are bugs.
- **Acceptance:** Fixture tests green; alert-only always carries a reason.

### M2-S2 — Live LiteLLM integration harness
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG 26, 8, 11
- **Story:** As Eng, when I cap a workload against a real LiteLLM proxy, spend past budget returns 429 and Delta-V labels the mode `enforced` (or `alert-only` if unreachable).
- **Assumptions:**
  - Docker-compose pinned LiteLLM image; API-level tests, no Playwright.
  - Virtual key metadata carries workload tags.
  - This is what converts the hard-ceiling claim from architectural to CI-backed.
- **Acceptance:** Provision key → callback ingest → budget write → overspend 429 → unreachable → alert-only.

### M2-S3 — Wire `cap_budget` / throttle through gateway write-back
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG 11
- **Story:** As Eng, “cap this workload” writes policy to the connected gateway when available; otherwise the UI/narration says alert-only.
- **Assumptions:** Guardrail still runs first (role + impact); write-back is execution after allow. Simulation path remains for synthetic M1 demos.
- **Acceptance:** Three modes labeled in tool result + UI: enforced / delegated / alert-only. No implied cutoff on alert-only.

### M2-S4 — OTLP GenAI ingestion endpoint
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG 1
- **Story:** As a platform team, I can point OTel GenAI exporters (SDKs, frameworks, many gateways) at Delta-V and get `UsageEvent`s.
- **Assumptions:** One OTLP HTTP endpoint covers most of the agentic ecosystem; frameworks are sources into OTLP, not separate parsers.
- **Acceptance:** Mapped semconv → UsageEvent; dropped/unmapped recorded; totals reconcile.

### M2-S5 — CSV / Excel upload connector
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG 2
- **Story:** As a pilot prospect, I can upload a spend dump and map columns to UsageEvent without engineering a pipeline first.
- **Assumptions:** Lowest-friction on-ramp; schema already is the contract.
- **Acceptance:** Upload → column map → ingest preview → confirm; bad rows dropped with reasons.

### M2-S6 — Attribution mapping + unattributed bucket
- **Priority:** P0 · **Status:** Todo (partial: `applyAttributionMapping` exists) · **Maps to:** BACKLOG 3
- **Story:** As FinOps, partial tagging never breaks reconciliation — missing dims land in an explicit unattributed bucket.
- **Assumptions:** Mapping is per-connector config; user_id null means autonomous, not “unattributed.”
- **Acceptance:** Configured map applied at ingest; unmapped → bucket; rollups still sum to 100%.

### M2-S7 — AI-assisted attribution mapping wizard
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG 4, 15
- **Story:** As a first-time connector user, Delta-V proposes feature/team/user mappings from the raw dump; I confirm before apply.
- **Assumptions:** Propose-and-confirm only — never silent auto-map (honest-numbers discipline). Flagship self-serve differentiator.
- **Acceptance:** Proposal UI + confirm; audit of accepted mapping; demo beat “connect → propose → confirm → dashboards.”

### M2-S8 — Event store / aggregates architecture
- **Priority:** P0 · **Status:** Todo · **Maps to:** BACKLOG 0
- **Story:** As a pilot customer at volume, dashboards and detectors query aggregates, not a 9MB client JSON.
- **Assumptions:** ClickHouse-class OLAP (managed OK); engine logic unchanged, execution moves server-side; generator doubles as load test.
- **Acceptance:** Ingest path → micro-batch → aggregates; client queries aggregates; stress note at 10–100× synthetic volume.

---

## Epic M2-E2 — Broader connectors & reconciliation

### M2-S9 — Provider usage-API reconciliation
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 5
- **Story:** As FinOps, I can reconcile telemetry totals against Anthropic/OpenAI billed usage.
- **Assumptions:** Coarse (no feature/team/user); authoritative for dollars; not a replacement for tagged telemetry.
- **Acceptance:** Pull + compare + variance surfaced; no fake attribution invented to fill gaps.

### M2-S10 — OpenRouter poll adapter
- **Priority:** P2 · **Status:** Todo · **Maps to:** BACKLOG 27
- **Story:** As a customer on OpenRouter, usage is polled and normalized; enforcement stays alert-only.
- **Assumptions:** Management key required; 30-day analytics window; dedupe on re-poll.
- **Acceptance:** Fixture + optional live cheap-model test; `syncPolicy` → alert-only unsupported.

### M2-S11 — Additional gateways (Helicone, Portkey, Lunar.dev)
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 8
- **Story:** As a customer on other gateways, I get the same ingest (± enforce where the gateway can).
- **Assumptions:** Prefer OTLP when available; native adapter only when export isn’t OTel-shaped. Portkey is a strong enforce peer to LiteLLM.
- **Acceptance:** Per-gateway adapter or documented OTLP path; enforcement capability declared in adapter info.

### M2-S12 — Cloud billing exports (AWS CUR / FOCUS)
- **Priority:** P2 · **Status:** Todo · **Maps to:** BACKLOG 9
- **Story:** As FinOps, compute/infra slices from cloud billing exports join the same model.
- **Assumptions:** Machine-readable cost files — not QuickBooks. Coarse attribution expected.
- **Acceptance:** CUR/FOCUS → UsageEvent path for compute slice; labeled coarse.

### M2-S13 — Dogfood Delta-V’s own reasoning spend
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 6, 38
- **Story:** As the builder/demoer, Delta-V meters its own agent calls (“it watches itself”).
- **Assumptions:** Cheap once ingest exists; content piece gated on this.
- **Acceptance:** Reasoning calls appear as UsageEvents; optional demo beat.

---

## Epic M2-E3 — Product surfaces on real data

### M2-S14 — Agent fleet + workload anatomy views
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 7 (`workload_id` schema Done)
- **Story:** As an Eng lead running many agents, I can rank fleets by burn/anomaly and open a workload’s pipeline cost structure.
- **Assumptions:** `workload_id` already on schema; views are the remaining work. Feature ≠ workload.
- **Acceptance:** Fleet ranking + per-agent drill + ordered step anatomy vs fixed resources.

### M2-S15 — Cost-to-serve / margin by customer
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 25
- **Story:** As FinOps, I see usage vs cost-to-serve divergence by customer (not chargeback).
- **Assumptions:** One dimension + rollup only; `x_customer_id` from gateway metadata; no hierarchy trees.
- **Acceptance:** Rollup + margin view; generator emits skewed customers for demos.

### M2-S16 — Generic drill-down for any chart
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 16
- **Story:** As a user, I can ask the agent to drill any chart/table into underlying events (heatmap pattern generalized).
- **Assumptions:** Agent capability, not a fixed per-chart feature; shared filter helper.
- **Acceptance:** Works for at least daily series + one attribution chart beyond heatmap.

### M2-S17 — Budgeting layer (proactive governance)
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 13
- **Story:** As FinOps, I set per-slice budgets/soft thresholds the forecast and detector evaluate continuously.
- **Assumptions:** Replaces single hardcoded demo budget for real use; reactive cap remains the emergency brake; honest defaults proposed then confirmed.
- **Acceptance:** Persisted budget objects; soft vs hard; evaluated without a chat ask.

### M2-S18 — User-configurable governance
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 14
- **Story:** As Org admin / Eng, I edit budgets, guardrail limits, and thresholds (chat-first, settings fallback); changes are guardrailed + audited.
- **Assumptions:** Depends on persistence + RBAC. Changing a guardrail is itself a guardrailed action.
- **Acceptance:** Edit path + audit entry; FinOps cannot raise own execute authority.

---

## Epic M2-E4 — Trust, access, maturity

### M2-S19 — SSO / RBAC + personas
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 10
- **Story:** As a customer IdP admin, groups map to Delta-V roles (FinOps, Eng, Finance controller, Exec, Org admin).
- **Assumptions:** SAML/OIDC + SCIM; multi-workspace scoping; audit log of actions.
- **Acceptance:** At least one IdP path; role gates match product personas.

### M2-S20 — Persistence (pins/layouts) + model-provider adapter
- **Priority:** P1 · **Status:** Todo · **Maps to:** BACKLOG 17, 37
- **Story:** As a returning user, pins survive refresh; as compliance, narration can use our model endpoint.
- **Assumptions:** BYO model is deployment/compliance, not cost; quality floor or explicit labeling required.
- **Acceptance:** Per-user/workspace persistence; configurable narration endpoint with label.

### M2-S21 — BI / FOCUS export
- **Priority:** P2 · **Status:** Todo · **Maps to:** BACKLOG 18
- **Story:** As Finance, I export FOCUS-ish CSV/Parquet (with `x_` extensions) into existing BI tools.
- **Assumptions:** Early = file/API export; warehouse sync later; native Power BI connector only after paying signal.
- **Acceptance:** Spec-conformant columns documented + downloadable sample.

### M2-S22 — Approval workflow + autonomous enforcement
- **Priority:** P2 · **Status:** Todo · **Maps to:** BACKLOG 20–21
- **Story:** As FinOps, I approve Eng actions; later, pre-set policies can auto-act within the same guardrail.
- **Assumptions:** Same deterministic gate for reactive / proactive / autonomous. Alert-only autonomy first.
- **Acceptance:** Pending queue for approvals; autonomous path documented + gated.

### M2-S23 — MCP server for engine tools
- **Priority:** P2 (fast-follow if “BYO agent” becomes central) · **Status:** Todo · **Maps to:** BACKLOG 22
- **Story:** As a customer with their own agent, I can call Delta-V tools over MCP.
- **Assumptions:** Tools stay model-agnostic; doesn’t replace the product UI.
- **Acceptance:** MCP exposes read tools + guardrailed actions; auth story defined.

### M2-S24 — SOC 2 / embedded SDK / extra presets
- **Priority:** Parked · **Maps to:** BACKLOG 19, 23, 24
- **Assumptions:** Controls built along the way; certification and SDK wait for demand signal.

---

## Suggested sequencing (next 6 build slices)

1. **Close M1 P0:** M1-S1 (demo script rehearsal) — bank the demoable artifact.
2. **M1 P1 confidence pack:** M1-S2…S5 as a single “demo hardening” pass.
3. **Finish gateway teeth:** M2-S2 (live LiteLLM) → M2-S3 (wire cap through write-back).
4. **Pilot on-ramp:** M2-S5 (CSV) + M2-S6/S7 (mapping + AI wizard) — fastest human demo of real data.
5. **Scale path:** M2-S4 (OTLP) + M2-S8 (store/aggregates).
6. **Fleet / cost-to-serve:** M2-S14 + M2-S15 once events are real.

Do **not** start M2-S19+ until a named pilot needs them.

---

# Working this backlog in Cursor

Treat **`docs/STORIES.md` as the PM backlog** and **`BACKLOG.md` as the engineering appendix**.

### View / groom (PM mode)
1. Open `docs/STORIES.md` in the editor — this is the board (priority + status on each story).
2. Start a Cursor chat with `@docs/STORIES.md` and ask things like:
   - “What’s the next P0?”
   - “Groom M2-S2 — tighten acceptance and list risks”
   - “Mark M1-S1 Done and move status”
3. Optionally pin the file or add it to the chat’s context for every planning session.
4. Keep statuses in git (`Todo` → `In progress` → `Done`) so agents and humans share one source of truth — no separate Notion required unless you want stakeholders there.

### Build (agent mode)
Hand an agent **one story ID**, not a whole epic:

```text
Implement M2-S2 from @docs/STORIES.md.
Follow Assumptions and Acceptance exactly.
Respect CLAUDE.md honest-defaults + control-plane constraints.
Open a PR titled with the story id.
```

Rules of thumb:
- One story ↔ one branch ↔ one PR when possible (`cursor/<story-id>-slug-3780`).
- Agent must read Assumptions before coding (they encode non-goals).
- If Assumptions conflict with code reality, **update the story in the same PR** — don’t silently expand scope.
- Cross-link: story `Maps to: BACKLOG N` for deep technical notes.

### Optional later (if you outgrow a markdown board)
- Mirror story IDs to GitHub Issues / Projects (same IDs: `M2-S2`) for stakeholder visibility.
- Or Linear with the markdown file still canonical for agents (`@docs/STORIES.md` stays the intake contract).
- Cursor Goals are for long-running objectives you explicitly create — use sparingly (e.g. “Close Milestone 1”), not one goal per story.

### Definition of ready (for any story before an agent starts)
- [ ] Priority set
- [ ] Assumptions written (including non-goals)
- [ ] Acceptance testable
- [ ] Milestone clear (M1 vs M2 — don’t mix in one PR)
- [ ] Dependencies named (blocked by …)

### Definition of done
- [ ] Acceptance met
- [ ] Status → Done in this file
- [ ] BACKLOG.md checkbox / note updated if it was the technical twin
- [ ] PR merged (or drafted awaiting review)
