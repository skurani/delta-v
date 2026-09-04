# Delta-V — Product requirements

**Descriptor:** AI Spend Control Plane.

What the product must satisfy at each milestone. **How** it is built lives in
[SPEC.md](../SPEC.md). **What to ship next** lives in [STORIES.md](STORIES.md).
The full design dump and checkbox backlog is [BACKLOG.md](../BACKLOG.md).

**Status (design phase):** Working POC on synthetic data. Engine and guardrail
verified in mock mode. Gateway ingestion in progress. No customers yet; seeking
design partners who run agents in production.

---

## Cross-cutting requirements (every milestone)

These are non-negotiable product constraints. See also [PRINCIPLES.md](../PRINCIPLES.md).

1. **Control plane, not data plane.** Delta-V reads usage from and writes policy
   to the customer's gateway. It is never in the inference request path.
2. **Math for the meter, LLM for the judgment.** All figures trace to the engine;
   the model narrates and picks tools only.
3. **Honest defaults.** Thresholds, budgets, and anomaly sizes are independently
   justified, never demo-tuned.
4. **Deterministic guardrail.** Role gate + impact gate; code decides, model
   narrates the verdict.
5. **Honest enforcement modes.** Every cap is `enforced`, `delegated`, or
   `alert-only`. Never imply teeth that do not exist.
6. **Attribution degrades honestly.** Partial tagging lands in an explicit
   `unattributed` bucket; totals reconcile.

---

## Milestone 1 — Demoable POC (synthetic data) — banked

**Outcome:** A first-time viewer watches the golden path end-to-end; every number
is engine-backed; both guardrail gates fire; it looks like a product.

| # | Requirement |
| --- | --- |
| R1.1 | Chat-primary flow: spend overview → hidden anomaly → grounded explanation → computed fix → guardrailed action attempt. |
| R1.2 | Every number defensible; no LLM-invented figures. |
| R1.3 | Role gate (FinOps cannot execute) and impact gate (Eng held above authority) both demonstrable live. |
| R1.4 | Golden path repeatable via DEMO_SCRIPT.md; mock mode free and deterministic; real model path verified. |
| R1.5 | Delta-V branding, composable canvas (pin + live update), legible UI. |
| R1.6 | Documented and version-controlled (CLAUDE.md, README, repo). |

Leftover demo polish (rehearsal, edge states, deploy URL) is tracked in
STORIES.md M1 close-out, not M2 blockers.

---

## Milestone 2 — Real-data MVP (current)

**Outcome:** Real usage flows through the same engine; attribution degrades
honestly when tags are missing; a first pilot has at least one ingest path.

| # | Requirement |
| --- | --- |
| R2.1 | Real ingestion via at least one path (OTLP, CSV upload, and/or gateway callback). |
| R2.2 | Coarser-data tradeoff confronted: provider bills lack feature/team/user; explicit unattributed bucket or instrumentation required for rich views. |
| R2.3 | Gateway adapter seam: normalize to `UsageEvent`; `syncPolicy` with honest alert-only degradation. |
| R2.4 | Attribution mapping is per-connector config; propose-and-confirm wizard, never silent auto-map. |
| R2.5 | Engine moves server-side at volume; client queries aggregates, not a full JSON in-browser. |
| R2.6 | Pilot-scoped auth, persistence, multi-tenancy only when a named pilot needs them (not pre-committed platform). |

Prioritized build order: [STORIES.md](STORIES.md) Now queue (M2-S0 through M2-S3).

---

## Out of scope (until a paying signal)

Chargeback, hosted multi-tenant billing, Glean marketplace plugin, SOC 2 as a
project (build controls along the way), enterprise SSO before a named pilot asks.

---

## Doc map

| Doc | Role |
| --- | --- |
| **REQUIREMENTS.md** (this file) | Milestone finish lines and product constraints |
| **SPEC.md** | Original build spec: schema, generator, engine, agent shape |
| **STORIES.md** | PM backlog: stories, assumptions, acceptance, Now/Next |
| **BACKLOG.md** | Design dump, M2 item detail, definition of done checkboxes |
| **PRINCIPLES.md** | Locked architecture principles + CLAIMS_AUDIT |
| **DEMO_SCRIPT.md** | Repeatable golden-path demo beats |
