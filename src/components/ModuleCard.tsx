import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  lastScore?: { score: number; maxScore: number };
  attempts?: number;
  className?: string;
  delay?: number;
}

export function ModuleCard({
  title,
  description,
  icon,
  href,
  lastScore,
  attempts = 0,
  className,
  delay = 0,
}: ModuleCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        "group relative flex flex-col gap-4 rounded-lg border bg-card p-6",
        "shadow-sm hover:shadow-md transition-shadow duration-300",
        "opacity-0 animate-fade-up active:scale-[0.98] transition-transform",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        {lastScore && (
          <ScoreRing
            score={lastScore.score}
            maxScore={lastScore.maxScore}
            size={56}
            strokeWidth={5}
            showPercentage
          />
        )}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold leading-snug">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {attempts > 0 ? `${attempts} attempt${attempts !== 1 ? "s" : ""}` : "Not started"}
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Start <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
