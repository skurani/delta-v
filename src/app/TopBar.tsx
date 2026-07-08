// Top bar (64px, hairline border): logo lockup left; as-of scrubber and role
// toggle right. Role labels are FinOps/Eng — a pure UI relabel over the same
// member/admin permission logic (FinOps cannot execute actions; Eng executes
// within the impact limit).

import { LogoMark } from "./LogoMark";

export type Role = "member" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  member: "FinOps",
  admin: "Eng",
};

export function TopBar({
  asOfDay,
  dayIndex,
  dayCount,
  daysElapsed,
  daysTotal,
  onScrub,
  role,
  onRoleChange,
}: {
  asOfDay: string;
  dayIndex: number;
  dayCount: number;
  daysElapsed: number;
  daysTotal: number;
  onScrub: (index: number) => void;
  role: Role;
  onRoleChange: (role: Role) => void;
}) {
  return (
    <header className="topbar">
      <div className="lockup">
        <LogoMark size={28} />
        <div className="lockup-text">
          <span className="wordmark">Delta-V</span>
          <span className="descriptor">AI Spend Governor</span>
        </div>
      </div>
      <div className="topbar-controls">
        <label className="scrubber">
          <span className="mono-label">
            as of {asOfDay} · day {daysElapsed}/{daysTotal}
          </span>
          <input
            type="range"
            min={0}
            max={dayCount - 1}
            value={dayIndex}
            onChange={(e) => onScrub(Number(e.target.value))}
          />
        </label>
        <div className="role-toggle" title="Fake auth for the guardrail demo — FinOps cannot execute actions; Eng executes within the impact limit">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`role-seg ${role === r ? "role-seg-active" : ""}`}
              onClick={() => onRoleChange(r)}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
