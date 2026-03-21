import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  maxScore: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  showPercentage?: boolean;
}

function getScoreColor(pct: number): string {
  if (pct >= 0.75) return "text-score-high";
  if (pct >= 0.5) return "text-score-medium";
  return "text-score-low";
}

function getScoreStroke(pct: number): string {
  if (pct >= 0.75) return "stroke-score-high";
  if (pct >= 0.5) return "stroke-score-medium";
  return "stroke-score-low";
}

export function ScoreRing({
  score,
  maxScore,
  size = 120,
  strokeWidth = 8,
  className,
  label,
  showPercentage = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = maxScore > 0 ? score / maxScore : 0;
  const offset = circumference * (1 - pct);
  const gradientId = `score-gradient-${size}-${Math.round(pct * 100)}`;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop
              offset="100%"
              stopColor={pct >= 0.5 ? "hsl(var(--score-high))" : "hsl(var(--score-medium))"}
            />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border) / 0.55)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(
            "drop-shadow-[0_8px_16px_hsl(var(--primary)/0.18)]",
            getScoreStroke(pct)
          )}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={
            {
              "--score-offset": `${offset}`,
              animation: "score-fill 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            } as CSSProperties
          }
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn("fill-foreground font-semibold tabular-nums", getScoreColor(pct))}
          style={{
            fontSize: size * 0.2,
            transform: "rotate(90deg)",
            transformOrigin: "center",
          }}
        >
          {showPercentage ? `${Math.round(pct * 100)}%` : `${score}`}
        </text>
      </svg>
      {label && (
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
