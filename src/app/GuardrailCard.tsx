// Inline card for action-tool verdicts — the guardrail moment rendered in
// chat. Green = executed within authority; red = held and escalated, with
// the policy arithmetic shown.

import { usd2 } from "./format";
import { ROLE_LABEL, type Role } from "./TopBar";

// Wire values (member/admin) stay in the payload; render shows FinOps/Eng.
const roleLabel = (r: string) => ROLE_LABEL[r as Role] ?? r;

const ARCH_LABEL =
  "Policy written to your gateway. Delta-V is not in the request path.";

export interface ActionResult {
  action: string;
  feature: string;
  requested_cap_usd?: number;
  current_monthly_run_rate_usd: number;
  verdict: "allow" | "hold";
  reason: string;
  executed: boolean;
  simulation_note?: string;
  policy: {
    role: string;
    required_role: string;
    estimated_monthly_impact_usd: number;
    authority_limit_usd: number;
  };
}

export function GuardrailCard({ result }: { result: ActionResult }) {
  const held = result.verdict === "hold";
  return (
    <div className={`guardrail-card ${held ? "guardrail-hold" : "guardrail-allow"}`}>
      <div className="guardrail-head">
        <span className={`chip ${held ? "guardrail-chip-hold" : "guardrail-chip-allow"}`}>
          {held ? "action held — escalated" : "action executed"}
        </span>
        <span className="guardrail-action">
          {result.action}({result.feature}
          {result.requested_cap_usd !== undefined ? `, ${usd2(result.requested_cap_usd)}/mo` : ""})
        </span>
      </div>
      <div className="guardrail-math">
        <span>run-rate {usd2(result.current_monthly_run_rate_usd)}/mo</span>
        <span>impact {usd2(result.policy.estimated_monthly_impact_usd)}/mo</span>
        <span>authority limit {usd2(result.policy.authority_limit_usd)}/mo</span>
        <span>
          role {roleLabel(result.policy.role)}
          {held && result.policy.role !== result.policy.required_role
            ? ` (requires ${roleLabel(result.policy.required_role)})`
            : ""}
        </span>
      </div>
      <p className="guardrail-reason">{result.reason}</p>
      {result.simulation_note && <p className="fine-print">{result.simulation_note}</p>}
      <p className="fine-print">{ARCH_LABEL}</p>
    </div>
  );
}
