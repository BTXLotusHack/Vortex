import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import {
  useInterviewStore,
  type AttemptResult,
  type ModuleType,
} from "@/stores/interviewStore";
import { ArrowLeft, FileText, Mic, Code2, Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

const moduleLabels: Record<ModuleType, { label: string; icon: React.ReactNode }> = {
  "cv-screening": { label: "CV Screening", icon: <FileText className="h-4 w-4" /> },
  "voice-interview": { label: "Voice Interview", icon: <Mic className="h-4 w-4" /> },
  "technical-interview": { label: "Technical", icon: <Code2 className="h-4 w-4" /> },
};

export default function Results() {
  const { attempts, getTotalScore } = useInterviewStore();
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptResult | null>(null);
  const [filter, setFilter] = useState<ModuleType | "all">("all");
  const total = getTotalScore();

  const filtered = filter === "all" ? attempts : attempts.filter((attempt) => attempt.module === filter);

  return (
    <AppLayout>
      <div className="max-w-5xl pb-5 pt-0 md:pb-5 md:pt-0">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <div
          className="surface-hero mb-8 rounded-[2.25rem] border border-luxe px-6 py-7 opacity-0 animate-fade-up md:px-8"
          style={{ animationFillMode: "forwards" }}
        >
          <h1 className="font-display text-4xl md:text-5xl">Results & History</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Review your past attempts and track improvement across modules.
          </p>
        </div>

        {attempts.length === 0 ? (
          <div
            className="surface-glass rounded-[2rem] border border-luxe p-12 text-center opacity-0 animate-fade-up"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <p className="mb-4 text-muted-foreground">
              No attempts yet. Complete a module to see your results here.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div
              className="surface-glass mb-6 flex flex-col items-start gap-6 rounded-[2rem] border border-luxe p-6 opacity-0 animate-fade-up sm:flex-row sm:items-center"
              style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
            >
              <ScoreRing score={total.score} maxScore={total.max} size={96} strokeWidth={7} label="Total" />
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                  Overview
                </div>
                <h2 className="text-xl font-semibold">Overall Interview Readiness</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {attempts.length} total attempt{attempts.length !== 1 ? "s" : ""} across all modules.
                </p>
              </div>
            </div>

            <div
              className="mb-4 flex flex-wrap gap-2 opacity-0 animate-fade-up"
              style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
            >
              {(["all", "cv-screening", "voice-interview", "technical-interview"] as const).map(
                (value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setFilter(value);
                      setSelectedAttempt(null);
                    }}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97]",
                      filter === value
                        ? "bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.2)]"
                        : "bg-white/65 text-secondary-foreground hover:bg-muted"
                    )}
                  >
                    {value === "all" ? "All" : moduleLabels[value].label}
                  </button>
                )
              )}
            </div>

            <div className="space-y-2">
              {filtered.map((attempt, i) => {
                const module = moduleLabels[attempt.module];
                return (
                  <button
                    key={attempt.id}
                    onClick={() =>
                      setSelectedAttempt(selectedAttempt?.id === attempt.id ? null : attempt)
                    }
                    className={cn(
                      "surface-glass flex w-full items-center gap-4 rounded-[1.75rem] border border-luxe px-5 py-4 text-left transition-all",
                      "hover:-translate-y-0.5 active:scale-[0.99]",
                      selectedAttempt?.id === attempt.id && "ring-2 ring-primary/20",
                      "opacity-0 animate-fade-up"
                    )}
                    style={{
                      animationDelay: `${300 + i * 60}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {module.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{module.label}</p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(attempt.date).toLocaleDateString()}
                        </span>
                        {attempt.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(attempt.duration / 60)}m {attempt.duration % 60}s
                          </span>
                        )}
                        {attempt.jobRole && <span>{attempt.jobRole}</span>}
                      </div>
                    </div>
                    <ScoreRing
                      score={attempt.overallScore}
                      maxScore={attempt.maxScore}
                      size={44}
                      strokeWidth={4}
                    />
                  </button>
                );
              })}
            </div>

            {selectedAttempt && (
              <div className="mt-6">
                <h3 className="mb-3 font-display text-3xl">
                  Feedback - {moduleLabels[selectedAttempt.module].label}
                </h3>
                <FeedbackPanel feedback={selectedAttempt.feedback} />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
