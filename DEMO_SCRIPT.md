# Delta-V (AI Spend Governor) — Golden-Path Demo Script

A documented ~4-question sequence that reliably lands the story and culminates
in the guardrailed-action moment. Chat is non-deterministic on the real model,
so each beat lists the expected tool calls and fallback phrasings; in mock mode
(`USE_MOCK_LLM=true`) the sequence is fully deterministic.

## Setup

```sh
npm run generate            # once — writes data/usage-events.json (seeded)

# Terminal 1 — the agent server
USE_MOCK_LLM=true npm run reason      # free, deterministic (scripted decisions, REAL numbers)
# ...or for the real model: put ANTHROPIC_API_KEY in .env, then plain `npm run reason`

# Terminal 2 — the app
npm run dev
```

Open the app. The chat dock is always on the left; role **FinOps** (the
default — cannot execute actions), scrubber at the last day. The four suggested chips under the empty chat ARE the golden path — you
can click them in order instead of typing.

> Mock mode is honest about what it fakes: the model's *decision-making* is
> scripted, but every number in every answer comes from the real engine via
> real tool calls — same tool executor, same guardrail, same charts.

---

## Beat 1 — visibility

**Ask:** `How's my spend looking this month?`
*(fallbacks: "give me a spend overview", "are we on budget?")*

**Expect:** tools `get_spend_summary` + `get_daily_series` → inline daily-cost
chart. Narration: ~$2.8k spent, projected ~$2.8k vs $3,000 budget, **under**,
dominated by api spend — *and a flag that an anomaly is active*.

**Say:** "Topline looks healthy. But the agent is watching every slice, not
just the total — it already flagged something."

## Beat 2 — the catch (the meter sees what the invoice hides)

**Ask:** `Why did my LLM spend spike?`
*(fallbacks: "what happened last week?", "tell me about that anomaly")*

**Expect:** tools `get_anomalies` + `get_daily_series(llm)` → inline anomaly
card + LLM spike chart. Narration: LLM spend peaked at **3.5× the trailing
14-day median** ($14.07 vs $4.04), cost-per-event up 2.3× → **cost-mix
anomaly**, drivers claude-opus-4-8 (4.9×) and draft_reply (4.1×) — and the
kicker: *the blended daily total moved only 1.14× — invisible at the invoice
level.*

**Say:** "A product outage flooded the queue with hard tickets and everything
routed to the frontier model. Your invoice would never have shown this."

## Beat 3 — judgment (recommend, don't guess)

**Ask:** `What would fixing it save?`
*(fallbacks: "how do I fix it?", "what's the cheaper routing?")*

**Expect:** tool `get_routing_economics(draft_reply)`. Narration quotes the
engine's counterfactual: opus carries ~84% of draft_reply's cost from a
minority of calls; at the same token volume on gpt-5-mini the window would
cost ~$23 instead of ~$101 — **~$76/mo estimated savings, computed not
guessed** — plus the
engine's own caveat about quality on hard cases. Posture: recommendation only.

**Say:** "The savings figure came from a tool, not the model's imagination —
'math for the meter, LLM for the judgment.'"

## Beat 4 — THE GUARDRAIL (climax)

**Role: FinOps** (the default — don't touch the toggle).

**Ask:** `Cap the draft_reply budget at $20/mo`
*(fallbacks: "enforce a $20 cap on draft_reply", "limit the draft_reply spend to 20 dollars")*

**Expect:** tool `cap_budget(draft_reply, 20)` → **red guardrail card: ACTION
HELD — ESCALATED.** The policy math is on the card: run-rate ~$98/mo, estimated
impact ~$78/mo, authority limit $50/mo, role FinOps (requires Eng). The agent
explains the hold without apologizing and nothing was changed.

**Say:** "The agent *tried* to act, and a deterministic policy check — not the
model's own judgment — held it and escalated. Scoped authority, auditable
verdict. This is the difference between an agent you can deploy and automation
theater."

## Beat 5 — coda (both branches, optional)

Toggle role to **Eng**, then ask: `Cap the draft_reply budget at $70/mo`

**Expect:** green guardrail card: **ACTION EXECUTED** — impact ~$28/mo is
within the $50 authority limit and the role is Eng. (Simulated: the cap is
recorded in the server's action log; no live workload is modified — the card
says so.)

Both guardrail branches shown: measured action executes, drastic or
under-privileged action escalates.

---

## If the real model goes off-script

- It may call `get_spend_summary` where the mock calls a narrower tool — fine;
  the numbers are identical. Redirect with the fallback phrasings.
- If it recommends without being asked to act, that's the designed posture —
  Beat 4's explicit "cap ..." is what moves it to an action tool.
- Feature names matter: say **draft_reply**, not "the drafting feature".
- The scrubber changes the world: run the demo at the final day. Earlier than
  day 28 there is no anomaly, and Beat 2 will (correctly) find nothing.
