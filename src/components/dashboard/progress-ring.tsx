"use client";

/** SVG progress ring for the CA signé objective. */
export function ProgressRing({
  percent,
  label,
  size = 56,
}: {
  percent: number;
  label: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg
      width={size}
      height={size}
      role="img"
      aria-label={`${label} — ${clamped}%`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--brume)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--rouge-cuisina)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="fill-foreground font-mono text-[10px]"
      >
        {clamped}%
      </text>
    </svg>
  );
}
