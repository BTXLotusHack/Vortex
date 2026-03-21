import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import type { FeedbackItem } from "@/stores/interviewStore";

interface FeedbackPanelProps {
  feedback: FeedbackItem[];
  className?: string;
}

export function FeedbackPanel({ feedback, className }: FeedbackPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {feedback.map((item, i) => {
        const pct = item.score / item.maxScore;
        const barColor =
          pct >= 0.75
            ? "bg-score-high"
            : pct >= 0.5
              ? "bg-score-medium"
              : "bg-score-low";

        return (
          <div
            key={item.category}
            className="rounded-lg border bg-card p-5 opacity-0 animate-fade-up"
            style={{
              animationDelay: `${i * 100 + 200}ms`,
              animationFillMode: "forwards",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">{item.category}</h4>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {item.score}/{item.maxScore}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", barColor)}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {item.comment}
            </p>
            {item.suggestions.length > 0 && (
              <div className="space-y-2">
                {item.suggestions.map((s, j) => (
                  <div
                    key={j}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Lightbulb className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                    <span className="text-muted-foreground">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
