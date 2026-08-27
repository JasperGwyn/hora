import type { JSX } from "react";

type HourRingProps = {
  activeMs: number;
  idleMs: number;
  capacityMs?: number;
  label: string;
  caption: string;
};

const HOUR_MS = 60 * 60 * 1000;
const RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function HourRing({
  activeMs,
  idleMs,
  capacityMs = HOUR_MS,
  label,
  caption,
}: HourRingProps): JSX.Element {
  const capacity = Math.max(1, capacityMs);
  const activeLen = (Math.min(capacity, activeMs) / capacity) * CIRCUMFERENCE;
  const idleLen = (Math.min(capacity, idleMs) / capacity) * CIRCUMFERENCE;

  return (
    <div className="ring-wrap" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="rgba(244,238,228,0.08)"
          strokeWidth="14"
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="#8fa57a"
          strokeWidth="14"
          strokeDasharray={`${activeLen} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="#9a9186"
          strokeWidth="14"
          strokeDasharray={`${idleLen} ${CIRCUMFERENCE}`}
          strokeDashoffset={-activeLen}
          opacity="0.7"
        />
      </svg>
      <div className="ring-center">
        <div>
          <strong>{label}</strong>
          <span>{caption}</span>
        </div>
      </div>
    </div>
  );
}
