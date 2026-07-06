# FinOps Agent POC — Build Spec

**Product name:** AI Spend Governor
**Folder/repo name:** `ai-spend-agent` (terse for typing; product name is what shows in the UI and demo)

**What it is (one-liner):** A FinOps agent that observes a workload's multi-model LLM/API/compute spend, meters and attributes it, forecasts burn, catches runaway/inefficient usage, and *recommends* fixes — with one guardrailed *action* beat where it holds an over-budget workload before the spend lands.

**Scope stance:** MVP, but effective. Every decision below favors proving the *idea* over building production plumbing. Ship something demoable early; deepen only the hero beats.

---

## 1. Architecture (the mental model)

```
  WORKLOAD (simulated — NOT built for the POC)        FINOPS AGENT (the product)
  ─────────────────────────────────────────          ──────────────────────────
  Synthetic event generator stands in for a   ──emits──►  1. Meter    (math)
  healthcare-support agent: categorize →       usage       2. Attribute (math)
  draft response → eligibility check, etc.     events      3. Forecast  (math)
  Produces a realistic stream of billable                  4. Reason    (ONE batched LLM call)
  events, incl. a manufactured anomaly.                    5. Recommend / Act (guardrailed)
```

**Two agents, kept distinct:**
- **Workload agent** = the customer's thing that *spends* money. For the POC this is a **synthetic generator**, not a live agent. (Live agent = "Level 1," deferred.)
- **FinOps agent** = the product you build. It *observes* the workload's emitted usage events (loose coupling — it watches telemetry, it doesn't puppet the workload).

**Design principle:** *Math for the meter, LLM for the judgment.* Metering, attribution, and forecasting are arithmetic. Only the reasoning/recommendation step calls an LLM — and it does so in **batches** (one call per analysis window), with results **cached**. This keeps LLM volume trivial (a full demo = a handful of calls, no rate-limit worries) and is itself a cost-discipline talking point in interviews.

---

## 2. The `UsageEvent` schema (FOCUS-flavored)

Model it loosely on the **FOCUS** spec (FinOps Open Cost and Usage Specification) — the emerging standard for normalizing billing data. This makes the synthetic data look like real billing data and gives you an "I modeled it on FOCUS" credibility line.

```ts
UsageEvent {
  timestamp        // ISO datetime
  customer_id      // e.g. "acme-health"          ← attribution
  team_id          // e.g. "patient-support"      ← attribution
  feature          // "triage" | "draft_reply" | "lookup_order"  ← attribution (config-driven, see §3)
  resource_type    // "llm" | "api" | "compute" | "subscription"
  provider         // "anthropic" | "openai" | "crm_api" | "aws"
  model            // "claude-haiku" | "claude-opus" | "gpt-4o-mini" | null
  pricing_model    // "per_token" | "per_call" | "committed" | "flat"
  quantity         // 1200 (tokens) | 1 (call) | 0.5 (GB-hr)
  unit             // "tokens" | "calls" | "gb_hours" | "month"
  unit_cost        // price per unit
  cost             // derived: quantity * unit_cost (for committed/flat, see rating logic)
}
```

**Why the `pricing_model` field is the whole point:** the optimization advice differs by type, and modeling all four is what makes this a *FinOps* tool rather than a meter. This is where your TBM/cost-pool background shows:
- `per_token` LLM → "route to a cheaper model" / "cache this"
- `per_call` API → "batch these calls" / "cache repeated lookups"
- `committed` → "you're at 40% of your commit — overpaying" OR "you'll blow the commit — renegotiate"
- `flat` → baseline, mostly informational

---

## 3. Synthetic data generator (domain-agnostic, config-driven)

The generator is **domain-agnostic**. The domain is just a costume on the same event stream — the math, schema, anomaly, and reasoning don't care what the workload does. So the generator takes a small **config** (feature/step names, which model each step routes to, price points, baseline volume, anomaly pattern), and the domain becomes a one-line change, not a rewrite.

> **Interview payoff:** "the FinOps logic is domain-agnostic — here it is on customer support, but the same engine runs a coding agent or any metered workload" is a stronger claim than a hardcoded scenario. It shows you built the general thing.

**Default preset: generic SaaS customer support.** Most legible, zero baggage.
- Steps: `triage` (cheap model — classify the ticket) → `draft_reply` (expensive model on hard/escalated tickets, cheap on routine) → `lookup_order` (a `per_call` CRM/order API).
- Cheap-vs-expensive split is natural: simple FAQ → cheap model; angry escalation / complex troubleshooting → frontier model.
- Anomaly is dead obvious: **a product outage floods the queue with hard tickets → everything routes to the expensive model → inference cost spikes 3x+.**

**Back-pocket preset: coding agent (for the Wade conversation).** Rhymes with Netlify's "agents shipping code / racking up compute" bet.
- Steps: `lint`/`format` (cheap) → `debug`/`architect` (expensive) → a build/test `compute` cost.
- Anomaly: an agent stuck in a **retry loop** burning frontier-model tokens.
- Same generator, different config. Swap presets based on who you're demoing to.

**What each preset generates:**
- A **baseline period** (e.g. 30 days): normal daily volume flowing through the steps, emitting events across resource types. Costs sit in a believable band with day-to-day variance.
- A **manufactured anomaly** (e.g. day 28): the expensive model gets over-called per the preset's anomaly pattern. Inference cost spikes 3x+. This is the anomaly your agent must catch.

**Content is synthetic** — fake customers, fake tickets/tasks, fake spend. (For any sensitive-seeming domain, say so in the demo; it earns respect.)

**Resource mix (realistic, but scoped):** one cloud (call it **AWS**) + **2–3 LLM providers/models at different price points** + **1–2 third-party APIs** (one `per_call`, one `committed`) + **1 flat subscription**. Enough to demonstrate multi-provider attribution, model sprawl, and usage-vs-committed — without faking three cloud billing formats.
> Multi-cloud is a real FinOps pain point but **out of scope** for the POC. Say in the demo: "extends to multi-cloud via the same event schema" — true, and shows you know the shape.

**Model routing realism:** a cheap model for routine steps, an expensive model for hard steps. This makes "you used the expensive model for a task the cheap one could handle" a *defensible* recommendation, not an arbitrary one.

---

## 4. FinOps agent logic

**4a. Meter (math).** Rate each event to a cost. For `per_token`/`per_call`/`per_gb_hour`: `quantity * unit_cost`. For `committed`: track consumption against the commitment tier (e.g. $2k/mo for 100k calls, overage rate beyond). For `flat`: fixed monthly.

**4b. Attribute (math).** Roll costs up by `customer_id`, `team_id`, `feature`, `provider`, `model`, `resource_type`. This powers the "whose spend is this / what's it for" views. (Your TBM allocation muscle.)

**4c. Forecast (math).** Project month-end spend from burn rate. Start simple (trailing average / linear), then optionally add a light trend adjustment. Output: "at current burn you'll hit ~$X by month-end vs $Y budget → over/under by $Z."

**4d. Reason (ONE batched LLM call).** Summarize the window (totals, top drivers, the detected anomaly, forecast vs budget) into a compact context and make a *single* call to the Anthropic (or OpenAI) API: "Here's the cost picture. What's anomalous, why, and what do you recommend?" Return structured output (finding + explanation + ranked recommendations + estimated impact). **Cache the result** so re-demoing doesn't re-call.

**4e. Recommend / Act (guardrailed — the hero beat).**
- **Default = recommend.** Agent surfaces the fix ("route feature X from opus → haiku, est. save ~$1,200/mo"); a human clicks to accept. Safe, believable, what most of the market ships.
- **ONE act-with-guardrail beat.** The agent *attempts* an action (e.g. throttle/cap the runaway workload) → the action is **checked against a scoped budget/permission before executing** → allowed, or **blocked/escalated** if it exceeds authority. Show the check and the decision. This is the "agent acts within scoped authority" moment FinOps leaders explicitly ask for (scoped permissions, audit logs, guardrails).
- **Do NOT** demo fully-autonomous production mutation as the headline — it reads as reckless. The *judgment* of when to act vs. defer is the sophisticated PM signal.

> **MVP discipline:** the guardrail is ONE clear moment, not a full permissions system. Two fake roles (admin vs. member) + one budget cap is enough to tell the story.

---

## 5. Screens (single-page app)

Keep it to the minimum that tells the story:

1. **Dashboard** — total spend for the window, spend-by-provider/model, spend-by-team/feature (attribution), and the **forecast vs budget** gauge. This is the "visibility" story.
2. **Anomaly alert** — a clear surfaced card when the spike is detected: what, how big, which driver.
3. **Agent reasoning panel** — the FinOps agent's analysis shown *openly* (finding → why → ranked recommendations → estimated impact). Reasoning visible, not hidden — this is the trust story.
4. **Action + guardrail moment** — the recommend-vs-act interaction, including the guardrail check firing (allowed / blocked-escalated). The hero demo beat.

---

## 6. Tech stack

- **Frontend:** React single-page app.
- **LLM calls:** plain `fetch` to the Anthropic API from a **thin local server** (Node/Express) during dev. The server holds the API key.
- **Metering/attribution/forecast:** plain JS/TS math in the app or server — no LLM.
- **Data:** the synthetic generator writes a JSON event stream the app reads.

### ⚠️ API key security (non-negotiable)
- **Never put API keys in the frontend.** A client-side app with an embedded key exposes it to anyone who opens dev tools.
- LLM calls go through the **server-side function**; the key lives in a server environment variable that *you* set (in `.env` locally, in the host's dashboard when deployed). Keys are never hardcoded and never committed to git (add `.env` to `.gitignore`).

---

## 7. Build sequence (2–3 weeks, always demoable)

Ordered so you have something showable at the end of each block, and so it fits around interviews.

**Week 1 — Substrate + visibility**
1. `UsageEvent` schema + synthetic generator (baseline only first).
2. Metering (rating logic for all four pricing models).
3. Attribution rollups.
4. Dashboard screen showing spend + attribution.
→ *Demoable:* "here's a metered, attributed view of a workload's spend."

**Week 2 — Intelligence**
5. Add the manufactured anomaly to the generator.
6. Anomaly detection (math threshold) + alert card.
7. Forecast vs budget.
8. The batched LLM reasoning call + reasoning panel (with caching).
→ *Demoable:* "it catches the spike, forecasts the overrun, and explains what to do."

**Week 3 — Hero beat + polish**
9. Recommend interaction (accept a recommendation).
10. The ONE guardrailed-action beat (budget cap + role check + block/escalate).
11. Visual polish; tighten the demo narrative to ~3 minutes.
12. *(Optional)* deploy to Netlify — free, one authentic Wade talking point; keys stay server-side. Swap to Vercel without a second thought if Netlify fights you.
→ *Demoable:* the full story end to end.

**Stretch (only if ahead):** Level 1 real workload agent; light trend-based forecast; multi-cloud note made concrete.

---

## Decisions log (so you don't relitigate)
- **Domain:** AI/LLM-spend FinOps (the frontier — 98% of practitioners now manage AI spend; only ~20% forecast it within 10%). Not crowded rightsizing turf.
- **Meter = substrate (commodity), intelligence = hero (differentiated).** Don't build "just a meter."
- **Recommend by default, ONE guardrailed action.** Judgment > automation theater.
- **Synthetic data for the POC** (Level 1 live agent deferred). Say so honestly in the demo.
- **Domain-agnostic generator, config-driven.** Default preset = generic customer support (most legible, zero baggage); coding-agent preset in back pocket for Wade. Domain is a label, not a rebuild.
- **FOCUS-flavored schema** for credibility.
- **Framing:** portfolio/interview asset — NOT a startup. (Avoids the W2-commitment signal mid-search.)
- **Netlify deploy = garnish for Wade, not a differentiator.** App doesn't need it.
