// Guardrail policy (SPEC §4e — the hero beat). Deterministic code, NOT model
// judgment: the model requests an action, this function decides, the model
// narrates the verdict it is handed. Deliberately minimal per the MVP
// decision — two roles + one authority limit, not a permissions system.

export type Role = "admin" | "member";

// A single scoped-authority cap: the agent may autonomously execute actions
// whose estimated monthly spend impact is at or below this. Set the honest
// way — roughly half the affected feature's typical run-rate, so a measured
// cap executes and a drastic one escalates. Not tuned to force a demo outcome.
export const ACTION_AUTHORITY_LIMIT_USD = 50;

export interface ActionRequest {
  tool: "cap_budget" | "throttle_workload";
  feature: string;
  estimatedMonthlyImpactUsd: number; // computed by the engine, not the model
}

export interface GuardrailDecision {
  verdict: "allow" | "hold";
  reason: string;
  policy: {
    role: Role;
    required_role: Role;
    estimated_monthly_impact_usd: number;
    authority_limit_usd: number;
  };
}

export function checkGuardrail(action: ActionRequest, role: Role): GuardrailDecision {
  const impact = Math.round(action.estimatedMonthlyImpactUsd * 100) / 100;
  const policy = {
    role,
    required_role: "admin" as Role,
    estimated_monthly_impact_usd: impact,
    authority_limit_usd: ACTION_AUTHORITY_LIMIT_USD,
  };

  // Rule 1 — role gate: members can never execute actions.
  if (role !== "admin") {
    return {
      verdict: "hold",
      reason: `Action held: executing ${action.tool} on "${action.feature}" requires the admin role; current role is ${role}. Escalated for admin approval.`,
      policy,
    };
  }

  // Rule 2 — impact gate: even admins hold when the estimated monthly
  // impact exceeds the scoped authority limit.
  if (impact > ACTION_AUTHORITY_LIMIT_USD) {
    return {
      verdict: "hold",
      reason: `Action held: estimated monthly impact $${impact} exceeds the $${ACTION_AUTHORITY_LIMIT_USD} autonomous-action authority limit. Escalated for human approval.`,
      policy,
    };
  }

  return {
    verdict: "allow",
    reason: `Action authorized: estimated monthly impact $${impact} is within the $${ACTION_AUTHORITY_LIMIT_USD} authority limit and role is admin.`,
    policy,
  };
}
