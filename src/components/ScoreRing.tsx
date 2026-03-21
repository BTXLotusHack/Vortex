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

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={getScoreStroke(pct)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={
            {
              "--score-offset": `${offset}`,
              animation: "score-fill 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            } as React.CSSProperties
          }
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn("fill-foreground font-semibold tabular-nums", getScoreColor(pct))}
          style={{
            fontSize: size * 0.22,
            transform: "rotate(90deg)",
            transformOrigin: "center",
          }}
        >
          {showPercentage ? `${Math.round(pct * 100)}%` : `${score}`}
        </text>
      </svg>
      {label && (
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
