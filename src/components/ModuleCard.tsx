import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { ArrowRight, Lock } from "lucide-react";
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
  disabled?: boolean;
  disabledReason?: string;
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
  disabled = false,
  disabledReason,
}: ModuleCardProps) {
  const cardClassName = cn(
    "group surface-glass noise-overlay relative flex min-h-[280px] flex-col gap-5 overflow-hidden rounded-[2rem] border border-luxe p-6",
    "shadow-luxe transition-all duration-500",
    disabled
      ? "cursor-not-allowed opacity-70"
      : "hover:-translate-y-1.5 hover:shadow-[0_24px_50px_hsl(166_35%_12%/0.14)] active:scale-[0.985]",
    "opacity-0 animate-fade-up",
    className
  );

  const content = (
    <>
      <div className="absolute right-[-3.5rem] top-[-3.5rem] h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-transform duration-500 group-hover:scale-125" />

      <div className="relative flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5)]">
          {icon}
        </div>
        {lastScore ? (
          <ScoreRing
            score={lastScore.score}
            maxScore={lastScore.maxScore}
            size={56}
            strokeWidth={5}
            showPercentage
          />
        ) : disabled ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      <div className="relative space-y-2">
        <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Module
        </div>
        <h3 className="text-[1.35rem] font-semibold leading-snug text-balance">{title}</h3>
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        {disabledReason && <p className="text-sm leading-6 text-primary">{disabledReason}</p>}
      </div>

      <div className="relative mt-auto flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-xs tabular-nums text-muted-foreground">
          {disabled
            ? "Locked"
            : attempts > 0
              ? `${attempts} attempt${attempts !== 1 ? "s" : ""}`
              : "Not started"}
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary transition-transform duration-300 group-hover:translate-x-1">
          {disabled ? "Unlock with CV" : "Explore"} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className={cardClassName} style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
        {content}
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={cardClassName}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {content}
    </Link>
  );
}
