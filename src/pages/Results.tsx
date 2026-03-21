import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { useInterviewStore, type AttemptResult, type ModuleType } from "@/stores/interviewStore";
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

  const filtered = filter === "all" ? attempts : attempts.filter((a) => a.module === filter);

  return (
    <AppLayout>
      <div className="px-6 py-8 md:px-10 md:py-10 max-w-4xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <div className="mb-8 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
          <h1 className="text-2xl font-bold">Results & History</h1>
          <p className="mt-1.5 text-muted-foreground">
            Review your past attempts and track improvement across modules.
          </p>
        </div>

        {attempts.length === 0 ? (
          <div
            className="rounded-lg border bg-card p-12 text-center opacity-0 animate-fade-up"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <p className="text-muted-foreground mb-4">No attempts yet. Complete a module to see your results here.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Overall score */}
            <div
              className="flex flex-col sm:flex-row items-center gap-6 rounded-lg border bg-card p-6 mb-6 opacity-0 animate-fade-up"
              style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
            >
              <ScoreRing score={total.score} maxScore={total.max} size={96} strokeWidth={7} label="Total" />
              <div>
                <h2 className="font-semibold">Overall Interview Readiness</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {attempts.length} total attempt{attempts.length !== 1 ? "s" : ""} across all modules.
                </p>
              </div>
            </div>

            {/* Filter tabs */}
            <div
              className="flex gap-2 mb-4 flex-wrap opacity-0 animate-fade-up"
              style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
            >
              {(["all", "cv-screening", "voice-interview", "technical-interview"] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setSelectedAttempt(null); }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.97]",
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-muted"
                    )}
                  >
                    {f === "all" ? "All" : moduleLabels[f].label}
                  </button>
                )
              )}
            </div>

            {/* Attempts list */}
            <div className="space-y-2">
              {filtered.map((attempt, i) => {
                const mod = moduleLabels[attempt.module];
                const pct = attempt.overallScore / attempt.maxScore;
                return (
                  <button
                    key={attempt.id}
                    onClick={() =>
                      setSelectedAttempt(selectedAttempt?.id === attempt.id ? null : attempt)
                    }
                    className={cn(
                      "w-full flex items-center gap-4 rounded-lg border bg-card px-5 py-4 text-left transition-all",
                      "hover:shadow-sm active:scale-[0.99]",
                      selectedAttempt?.id === attempt.id && "ring-2 ring-primary/20",
                      "opacity-0 animate-fade-up"
                    )}
                    style={{
                      animationDelay: `${300 + i * 60}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {mod.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{mod.label}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
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

            {/* Selected attempt detail */}
            {selectedAttempt && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">
                  Feedback — {moduleLabels[selectedAttempt.module].label}
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
