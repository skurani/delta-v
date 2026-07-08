// FOCUS-flavored usage event schema (SPEC.md §2).
// One event = one billable unit of usage emitted by the workload.

export type ResourceType = "llm" | "api" | "compute" | "subscription";
export type PricingModel = "per_token" | "per_call" | "committed" | "flat";
export type Unit = "tokens" | "calls" | "gb_hours" | "month";

export interface UsageEvent {
  timestamp: string; // ISO datetime
  customer_id: string;
  team_id: string;
  workload_id: string; // the spending agent/workload (e.g. "support-agent") — a customer/team can run several
  user_id: string | null; // human seat that invoked the agent; null = autonomous/scheduled run
  feature: string; // config-driven step name (SPEC.md §3)
  resource_type: ResourceType;
  provider: string;
  model: string | null;
  pricing_model: PricingModel;
  quantity: number;
  unit: Unit;
  unit_cost: number;
  cost: number; // quantity * unit_cost (committed/flat re-rated by the meter later)
}

// ---------------------------------------------------------------------------
// Generator config (SPEC.md §3) — the domain is a costume on this config.
// ---------------------------------------------------------------------------

export interface ModelPrice {
  provider: string;
  model: string;
  unit_cost: number; // blended $/token (input+output averaged for the POC)
  avgTokens: number; // typical tokens per invocation of this step
}

export interface Step {
  feature: string;
  resource_type: "llm" | "api" | "compute";
  pricing_model: "per_token" | "per_call";
  // Probability an invocation of this step is attached to a human seat
  // (vs. an autonomous/scheduled run → user_id: null). Default 0.
  seatShare?: number;
  // LLM steps route between a cheap and an expensive model:
  routing?: {
    cheap: ModelPrice;
    expensive: ModelPrice;
    expensiveShare: number; // baseline fraction routed to the frontier model (0..1)
  };
  // non-LLM steps (per_call API, per-unit compute):
  call?: {
    provider: string;
    unit_cost: number;
    unit: "calls" | "gb_hours";
    avgQuantity: number;
  };
}

export interface FixedResource {
  feature: string;
  resource_type: "compute" | "subscription" | "api";
  provider: string;
  pricing_model: "committed" | "flat";
  cadence: "daily" | "monthly";
  provisioned: { quantity: number; unit: Unit; unit_cost: number };
}

// A committed-use contract the meter rates consumption against (SPEC.md §4a).
// Matched to events by provider + feature.
export interface CommitmentTier {
  provider: string;
  feature: string;
  unit: Unit;
  includedQuantityPerMonth: number; // usage covered by the committed fee
  committedCostPerMonth: number; // paid regardless of usage
  overageRate: number; // $/unit beyond the included quantity
}

export interface AnomalyPattern {
  day: number; // day index (0-based) the anomaly begins
  durationDays: number; // full-intensity days; a ramp-in and decay tail are added around them
  affectedStep: string; // feature whose model routing is disrupted
  volumeMultiplier: number; // queue floods: whole-pipeline volume multiplier at peak
  expensiveShareOverride: number; // affected step's frontier-model share at peak
  description: string; // narrative for the demo ("product outage floods the queue...")
}

export interface GeneratorConfig {
  preset: string;
  customer_id: string;
  team_id: string;
  workload_id: string; // one preset = one workload for the POC
  seed: number; // deterministic output for a given config
  days: number;
  baselineVolumePerDay: number; // work units (tickets/tasks) per day
  dailyVariance: number; // ± fraction of day-to-day volume jitter
  users: string[]; // named seats; usage is skewed toward earlier entries
  steps: Step[];
  fixedResources: FixedResource[];
  commitments: CommitmentTier[]; // contracts the meter rates committed usage against
  anomaly: AnomalyPattern;
}
