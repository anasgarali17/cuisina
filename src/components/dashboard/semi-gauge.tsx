"use client";

/**
 * Semicircle gauge — brume track, Cuisina-red value arc, percent in mono
 * centered under the arc. Reference-style replacement for the full ring.
 */
export function SemiGauge({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const arcLength = Math.PI * 42;
  const offset = arcLength * (1 - clamped / 100);

  return (
    <svg
      viewBox="0 0 100 56"
      role="img"
      aria-label={`${label} — ${clamped}%`}
      className="w-24"
    >
      <path
        d="M 8 50 A 42 42 0 0 1 92 50"
        fill="none"
        stroke="var(--brume)"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {clamped > 0 && (
        <path
          d="M 8 50 A 42 42 0 0 1 92 50"
          fill="none"
          stroke="var(--rouge-cuisina)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      )}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        className="fill-foreground font-mono text-xs"
      >
        {clamped}%
      </text>
    </svg>
  );
}
