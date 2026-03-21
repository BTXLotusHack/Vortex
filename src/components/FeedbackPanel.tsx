import { cn } from "@/lib/utils";
import { Lightbulb } from "lucide-react";
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
            className="surface-glass rounded-[1.75rem] border border-luxe p-5 opacity-0 animate-fade-up"
            style={{
              animationDelay: `${i * 100 + 200}ms`,
              animationFillMode: "forwards",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">{item.category}</h4>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {item.score}/{item.maxScore}
              </span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted/80">
              <div
                className={cn("h-full rounded-full transition-all duration-700", barColor)}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <p className="mb-4 text-sm leading-7 text-muted-foreground">{item.comment}</p>
            {item.suggestions.length > 0 && (
              <div className="space-y-2">
                {item.suggestions.map((suggestion, j) => (
                  <div
                    key={j}
                    className="flex items-start gap-3 rounded-2xl bg-white/45 px-3 py-2 text-sm"
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span className="text-muted-foreground">{suggestion}</span>
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
