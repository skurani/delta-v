import type { GeneratorConfig } from "./schema";

// Blended $/token price points (input+output rates averaged — good enough for
// synthetic billing data; the meter never needs the input/output split).
//   claude-haiku-4-5   $1/$5 per MTok  → ~$3/MTok blended
//   claude-sonnet-5    $3/$15 per MTok → ~$9/MTok blended
//   claude-opus-4-8    $5/$25 per MTok → ~$15/MTok blended
//   gpt-5-mini         $0.25/$2 per MTok → ~$1.1/MTok blended
const HAIKU = { provider: "anthropic", model: "claude-haiku-4-5", unit_cost: 0.000003 };
const SONNET = { provider: "anthropic", model: "claude-sonnet-5", unit_cost: 0.000009 };
const OPUS = { provider: "anthropic", model: "claude-opus-4-8", unit_cost: 0.000015 };
const GPT_MINI = { provider: "openai", model: "gpt-5-mini", unit_cost: 0.0000011 };

// ---------------------------------------------------------------------------
// Default preset: generic SaaS customer support (SPEC.md §3).
// triage (cheap classify) → draft_reply (cheap routine / frontier on hard
// tickets) → lookup_order (per_call CRM API), plus a committed eligibility
// API, AWS batch compute, and a flat observability subscription.
// Anomaly: product outage floods the queue with hard tickets around day 28 —
// draft_reply routes almost everything to the expensive model.
// ---------------------------------------------------------------------------
export const customerSupportConfig: GeneratorConfig = {
  preset: "customer-support",
  customer_id: "acme-retail",
  team_id: "customer-support",
  seed: 20260702,
  days: 30,
  baselineVolumePerDay: 300, // tickets/day
  dailyVariance: 0.15,
  users: ["maria.chen", "dev.patel", "sam.okafor", "lena.kovacs", "tyler.brooks", "aisha.rahman"],
  steps: [
    {
      feature: "triage",
      resource_type: "llm",
      pricing_model: "per_token",
      seatShare: 0.05, // classification runs unattended on the inbound queue
      routing: {
        cheap: { ...HAIKU, avgTokens: 900 },
        expensive: { ...SONNET, avgTokens: 1400 },
        expensiveShare: 0.03, // occasional ambiguous ticket needs the bigger model
      },
    },
    {
      feature: "draft_reply",
      resource_type: "llm",
      pricing_model: "per_token",
      seatShare: 0.85, // an agent seat reviews/sends the draft
      routing: {
        cheap: { ...GPT_MINI, avgTokens: 2200 },
        expensive: { ...OPUS, avgTokens: 3800 },
        expensiveShare: 0.15, // escalations / complex troubleshooting
      },
    },
    {
      feature: "lookup_order",
      resource_type: "api",
      pricing_model: "per_call",
      seatShare: 0.7, // mostly fired from an agent's live session
      call: { provider: "crm_api", unit_cost: 0.01, unit: "calls", avgQuantity: 1.4 },
    },
  ],
  fixedResources: [
    {
      feature: "eligibility_check",
      resource_type: "api",
      provider: "verify_api",
      pricing_model: "committed",
      cadence: "daily",
      // ~40% of a 100k-calls/mo commit — the meter's "overpaying" storyline
      provisioned: { quantity: 1300, unit: "calls", unit_cost: 0.02 },
    },
    {
      feature: "batch_indexing",
      resource_type: "compute",
      provider: "aws",
      pricing_model: "committed",
      cadence: "daily",
      provisioned: { quantity: 36, unit: "gb_hours", unit_cost: 0.09 },
    },
    {
      feature: "observability",
      resource_type: "subscription",
      provider: "datadog",
      pricing_model: "flat",
      cadence: "monthly",
      provisioned: { quantity: 1, unit: "month", unit_cost: 450 },
    },
  ],
  commitments: [
    {
      // ~39k calls/mo against a 100k commit → ~40% utilization: the
      // "you're overpaying for this commit" storyline.
      provider: "verify_api",
      feature: "eligibility_check",
      unit: "calls",
      includedQuantityPerMonth: 100_000,
      committedCostPerMonth: 2000,
      overageRate: 0.03,
    },
    {
      // ~1080 gb-hr/mo against a 1000 commit → slight overage: the
      // "you'll blow through the commit" storyline.
      provider: "aws",
      feature: "batch_indexing",
      unit: "gb_hours",
      includedQuantityPerMonth: 1000,
      committedCostPerMonth: 90,
      overageRate: 0.13,
    },
  ],
  anomaly: {
    day: 27, // 0-based → "day 28"
    durationDays: 2,
    affectedStep: "draft_reply",
    volumeMultiplier: 1.5, // outage floods the queue
    expensiveShareOverride: 0.5, // hard tickets shift heavily to the frontier model
    description:
      "Product outage floods the queue with hard/escalated tickets; draft_reply routes far more traffic to the frontier model and inference cost spikes 3x+.",
  },
};

// ---------------------------------------------------------------------------
// Back-pocket preset: coding agent (same engine, different costume).
// lint (cheap) → debug (cheap routine / frontier on hard bugs) → build_test
// (per-unit compute). Anomaly: an agent stuck in a retry loop hammers the
// debug step with frontier-model calls.
// Swap in with one line in src/generate.ts:  const config = codingAgentConfig;
// ---------------------------------------------------------------------------
export const codingAgentConfig: GeneratorConfig = {
  preset: "coding-agent",
  customer_id: "acme-devtools",
  team_id: "platform-eng",
  seed: 20260702,
  days: 30,
  baselineVolumePerDay: 220, // agent tasks/day
  dailyVariance: 0.2,
  users: ["jo.nakamura", "felix.wright", "priya.iyer", "marcus.holm", "elena.vasquez"],
  steps: [
    {
      feature: "lint_format",
      resource_type: "llm",
      pricing_model: "per_token",
      seatShare: 0.1, // mostly CI/pre-merge automation
      routing: {
        cheap: { ...HAIKU, avgTokens: 1200 },
        expensive: { ...SONNET, avgTokens: 1800 },
        expensiveShare: 0.02,
      },
    },
    {
      feature: "debug_architect",
      resource_type: "llm",
      pricing_model: "per_token",
      seatShare: 0.6, // often a named engineer driving the agent
      routing: {
        cheap: { ...SONNET, avgTokens: 3000 },
        expensive: { ...OPUS, avgTokens: 6500 },
        expensiveShare: 0.2,
      },
    },
    {
      feature: "build_test",
      resource_type: "compute",
      pricing_model: "per_call",
      seatShare: 0.15, // builds/tests mostly run autonomously after the change lands
      call: { provider: "aws", unit_cost: 0.09, unit: "gb_hours", avgQuantity: 0.6 },
    },
  ],
  fixedResources: [
    {
      feature: "ci_runners",
      resource_type: "compute",
      provider: "aws",
      pricing_model: "committed",
      cadence: "daily",
      provisioned: { quantity: 55, unit: "gb_hours", unit_cost: 0.07 },
    },
    {
      feature: "code_search_api",
      resource_type: "api",
      provider: "sourcegraph_api",
      pricing_model: "committed",
      cadence: "daily",
      provisioned: { quantity: 900, unit: "calls", unit_cost: 0.015 },
    },
    {
      feature: "observability",
      resource_type: "subscription",
      provider: "datadog",
      pricing_model: "flat",
      cadence: "monthly",
      provisioned: { quantity: 1, unit: "month", unit_cost: 450 },
    },
  ],
  commitments: [
    {
      // ~1650 gb-hr/mo against a 1400 commit → overage.
      provider: "aws",
      feature: "ci_runners",
      unit: "gb_hours",
      includedQuantityPerMonth: 1400,
      committedCostPerMonth: 98,
      overageRate: 0.11,
    },
    {
      // ~27k calls/mo against a 60k commit → ~45% utilization.
      provider: "sourcegraph_api",
      feature: "code_search_api",
      unit: "calls",
      includedQuantityPerMonth: 60_000,
      committedCostPerMonth: 900,
      overageRate: 0.025,
    },
  ],
  anomaly: {
    day: 27,
    durationDays: 2,
    affectedStep: "debug_architect",
    volumeMultiplier: 2.0, // retry loop re-submits the same tasks
    expensiveShareOverride: 0.7,
    description:
      "An agent stuck in a retry loop re-runs failing debug tasks against the frontier model; inference cost spikes 3x+.",
  },
};
