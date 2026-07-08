// Delta-V logo mark, per the design handoff: triangle (delta) with the
// horizontal "limit bar" — the budget line the workload runs against.

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-label="Delta-V"
      role="img"
    >
      <path
        d="M48 12 L86 82 L10 82 Z"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1={28}
        y1={60}
        x2={68}
        y2={60}
        stroke="currentColor"
        strokeWidth={8}
        strokeLinecap="round"
      />
    </svg>
  );
}
