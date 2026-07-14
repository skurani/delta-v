# Delta-V — Architecture Principles (locked)

These are locked decisions, not preferences. They change by explicit recorded
amendment, never by copy drift. When public copy and a principle conflict, the
principle wins.

## P1 · Control plane, not data plane
Delta-V governs by reading usage from and writing policy to the gateway the
customer already runs (LiteLLM, Portkey). It is never in the request path.
**Forbids:** any claim or design that places Delta-V inline — "proxy," "sits in
the request path," or a Delta-V base_url for inference traffic.

## P2 · Math for the meter, LLM for the judgment
Every number comes from the deterministic engine; the model narrates, explains,
and decides what matters.
**Forbids:** the model computing, estimating, or re-deriving any figure a tool
can provide.

## P3 · Deterministic two-gate guardrail
Every action passes a role gate (may this actor execute at all?) and an impact
gate (does the change exceed authority?). Code decides; the model only narrates
the verdict.
**Forbids:** model-judgment authorization, single-gate shortcuts, or any execute
path that bypasses either gate.

## P4 · Honest degradation to alert-only
Without a gateway control point, Delta-V runs alert-only and says so. Every cap
carries an explicit mode: enforced, delegated, or alert-only.
**Forbids:** implying enforcement teeth where no control point exists.

## P5 · Virtual key is the shared unit of attribution and enforcement
The gateway key carries workload identity in (attribution) and budget authority
out (enforcement); one mapping serves both directions.
**Forbids:** attribution schemes enforcement cannot act on, caps keyed to
entities ingest cannot attribute, and retroactive tagging as a primary mechanism.

## P6 · All visualizations are agent-generated tool outputs
Every chart and table renders a tool call over engine data — pinnable,
reproducible, provenance-carrying.
**Forbids:** fixed hand-built dashboards, or any chart whose data cannot be
traced to the tool call that produced it.

---

# CLAIMS_AUDIT

Before any public surface ships (landing page, tour, demo script, README,
pitch deck), audit it against this file:

1. **Grep the surface** for architecture-claim language: `request path`,
   `in path`, `proxy`, `inline`, `upstream`, `route through`, `swap your key`,
   `base_url`, `enforce`, `guarantee`, `impossible`, `never exceed`, `ceiling`,
   `cap`, `real-time`, `all`, `every`, `never`.
2. **Check each hit against P1–P6.** Two failure modes: contradiction (the
   claim violates a Forbids line) and overclaim (the claim asserts more than
   the principle supports).
3. **Enforcement claims carry their qualifier.** "The invoice cannot exceed
   the ceiling" is true only for governed gateway traffic; unqualified, it is
   an overclaim (P4).
4. **Fix the surface, never the principle.** If copy and principle genuinely
   conflict, this file wins or is amended explicitly — amendments are recorded
   here with a date, not implied by shipped copy.

Precedent: 2026-07-14 landing audit found "sits in the request path," "routes
through the proxy," and "Route through the governor" — all P1 violations;
corrected to gateway write-back framing.
