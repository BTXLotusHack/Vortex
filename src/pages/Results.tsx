import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import {
  useInterviewStore,
  type AttemptResult,
  type FeedbackItem,
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

function getSummaryModuleLabel(module: ModuleType) {
  switch (module) {
    case "cv-screening":
      return "CV";
    case "voice-interview":
      return "Voice";
    case "technical-interview":
      return "Technical";
  }
}

function getSummaryModuleSurface(module: ModuleType) {
  switch (module) {
    case "cv-screening":
      return "border-primary/15 bg-primary/5";
    case "voice-interview":
      return "border-score-high/20 bg-score-high/10";
    case "technical-interview":
      return "border-score-medium/20 bg-score-medium/10";
  }
}

function splitSuggestionDetails(suggestions: string[]) {
  return suggestions.reduce(
    (acc, suggestion) => {
      if (/^Missing:/i.test(suggestion)) {
        acc.expectedAnswerPoints.push(suggestion.replace(/^Missing:\s*/i, "").trim());
      } else {
        acc.coachingTips.push(suggestion.trim());
      }
      return acc;
    },
    { expectedAnswerPoints: [] as string[], coachingTips: [] as string[] }
  );
}

export default function Results() {
  const { attempts, pipelineRuns, getTotalScore, getLatestAttempt } = useInterviewStore();
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptResult | null>(null);
  const [filter, setFilter] = useState<ModuleType | "all">("all");
  const total = getTotalScore();

  const filtered = filter === "all" ? attempts : attempts.filter((attempt) => attempt.module === filter);
  const finalSummaryAttempts = [
    getLatestAttempt("cv-screening"),
    getLatestAttempt("voice-interview"),
    getLatestAttempt("technical-interview"),
  ].filter((attempt): attempt is AttemptResult => Boolean(attempt));
  const pipelineComplete = finalSummaryAttempts.length === 3;
  const finalSummaryTotals = finalSummaryAttempts.reduce(
    (acc, attempt) => {
      acc.score += attempt.overallScore;
      acc.max += attempt.maxScore;
      return acc;
    },
    { score: 0, max: 0 }
  );
  const allFeedback = finalSummaryAttempts.flatMap((attempt) => attempt.feedback);
  const strongestSignals = [...allFeedback]
    .sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)
    .slice(0, 4);
  const weakestSignals = [...allFeedback]
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 4);
  const improvementActions = allFeedback
    .flatMap((item) => item.suggestions.map((suggestion) => `${item.category}: ${suggestion}`))
    .slice(0, 6);
  const totalCoverage = finalSummaryTotals.max ? Math.round((finalSummaryTotals.score / finalSummaryTotals.max) * 100) : 0;
  const totalLostPoints = Math.max(finalSummaryTotals.max - finalSummaryTotals.score, 0);
  const expectedAnswerGaps = allFeedback.reduce(
    (count, item) => count + splitSuggestionDetails(item.suggestions).expectedAnswerPoints.length,
    0
  );
  const stageBreakdowns = finalSummaryAttempts.map((attempt) => {
    const coverage = attempt.maxScore ? Math.round((attempt.overallScore / attempt.maxScore) * 100) : 0;
    const weakestCategory =
      [...attempt.feedback].sort((a, b) => b.maxScore - b.score - (a.maxScore - a.score))[0] || null;
    const strongestCategory =
      [...attempt.feedback].sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)[0] || null;

    return {
      attempt,
      coverage,
      lostPoints: Math.max(attempt.maxScore - attempt.overallScore, 0),
      weakestCategory,
      strongestCategory,
    };
  });

  return (
    <AppLayout>
      <div className="max-w-5xl pb-5 pt-0 md:pb-5 md:pt-0">
        <Link
          to="/dashboard"
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
              to="/dashboard"
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

            {false && pipelineComplete && (
              <div
                className="surface-glass mb-6 rounded-[2rem] border border-luxe p-6 opacity-0 animate-fade-up"
                style={{ animationDelay: "150ms", animationFillMode: "forwards" }}
              >
                <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Final Summary</p>

                <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <ScoreRing
                      score={finalSummaryTotals.score}
                      maxScore={Math.max(finalSummaryTotals.max, 1)}
                      size={102}
                      strokeWidth={7}
                      label="Total"
                    />
                    <div className="max-w-2xl">
                      <h2 className="text-xl font-semibold">Completed pipeline score</h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {finalSummaryTotals.score}/{finalSummaryTotals.max} across CV, voice, and technical. This report
                        shows where points were lost, which categories were weakest, and the expected answer points when
                        they were captured by the evaluator.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[460px]">
                    <div className="rounded-2xl bg-card px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Coverage</p>
                      <p className="mt-2 text-2xl font-semibold">{totalCoverage}%</p>
                      <p className="mt-1 text-sm text-muted-foreground">Overall points captured</p>
                    </div>
                    <div className="rounded-2xl bg-card px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Points Lost</p>
                      <p className="mt-2 text-2xl font-semibold">{totalLostPoints}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Across all completed stages</p>
                    </div>
                    <div className="rounded-2xl bg-card px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Answer Gaps</p>
                      <p className="mt-2 text-2xl font-semibold">{expectedAnswerGaps}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Expected answer points still missing</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {stageBreakdowns.map(({ attempt, coverage, lostPoints, weakestCategory, strongestCategory }) => (
                    <div
                      key={attempt.id}
                      className={cn("rounded-[1.75rem] border px-4 py-4", getSummaryModuleSurface(attempt.module))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{getSummaryModuleLabel(attempt.module)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {attempt.overallScore}/{attempt.maxScore} scored
                          </p>
                        </div>
                        <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-foreground">
                          {coverage}% coverage
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <div className="rounded-2xl bg-white/65 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Lost</p>
                          <p className="mt-2 text-lg font-semibold">{lostPoints} pts</p>
                        </div>
                        <div className="rounded-2xl bg-white/65 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Weakest</p>
                          <p className="mt-2 text-sm font-medium">{weakestCategory?.category || "Not enough data"}</p>
                        </div>
                        <div className="rounded-2xl bg-white/65 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Strongest</p>
                          <p className="mt-2 text-sm font-medium">{strongestCategory?.category || "Not enough data"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-3">
                  {stageBreakdowns.map(({ attempt }) => (
                    <div key={`${attempt.id}-details`} className="rounded-[1.75rem] border border-luxe bg-card/60 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Detailed Breakdown</p>
                          <h3 className="mt-2 text-lg font-semibold">{getSummaryModuleLabel(attempt.module)} stage</h3>
                        </div>
                        <div className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                          {attempt.feedback.length} scored categories
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        {attempt.feedback.map((item: FeedbackItem) => {
                          const detail = splitSuggestionDetails(item.suggestions);
                          const pointsMissed = Math.max(item.maxScore - item.score, 0);

                          return (
                            <div key={`${attempt.id}-${item.category}`} className="rounded-2xl border bg-background/80 px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold">{item.category}</p>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                    {item.score}/{item.maxScore}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 text-xs font-medium",
                                      pointsMissed > 0 ? "bg-score-low/10 text-score-low" : "bg-score-high/10 text-score-high"
                                    )}
                                  >
                                    {pointsMissed > 0 ? `${pointsMissed} pts missed` : "No points missed"}
                                  </span>
                                </div>
                              </div>

                              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.comment}</p>

                              {detail.expectedAnswerPoints.length > 0 && (
                                <div className="mt-4 rounded-2xl bg-score-low/10 px-3 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-score-low">
                                    Expected Answer Points
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {detail.expectedAnswerPoints.map((point) => (
                                      <span
                                        key={`${attempt.id}-${item.category}-${point}`}
                                        className="rounded-full border border-score-low/20 bg-white/80 px-3 py-1.5 text-xs leading-5 text-foreground"
                                      >
                                        {point}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {detail.coachingTips.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                    How To Recover Points
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    {detail.coachingTips.map((tip) => (
                                      <div
                                        key={`${attempt.id}-${item.category}-${tip}`}
                                        className="rounded-2xl bg-secondary/80 px-3 py-2 text-sm leading-6 text-muted-foreground"
                                      >
                                        {tip}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl bg-score-high/10 px-4 py-4">
                    <p className="text-sm font-semibold text-score-high">What you were good at</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {strongestSignals.length
                        ? strongestSignals.map((item) => `${item.category} (${item.score}/${item.maxScore})`).join(", ")
                        : "No strong signals available yet."}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-score-low/10 px-4 py-4">
                    <p className="text-sm font-semibold text-score-low">Where you lost points</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {weakestSignals.length
                        ? weakestSignals.map((item) => `${item.category} (${item.score}/${item.maxScore})`).join(", ")
                        : "No weak signals available yet."}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-card px-4 py-4">
                    <p className="text-sm font-semibold">What to improve next</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {improvementActions.length
                        ? improvementActions.join(" • ")
                        : "Complete more stages to unlock specific next actions."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {pipelineRuns.length > 0 && (
              <div
                className="mb-6 opacity-0 animate-fade-up"
                style={{ animationDelay: "180ms", animationFillMode: "forwards" }}
              >
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                    Pipeline History
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">Completed pipeline runs</h2>
                </div>

                <div className="space-y-2">
                  {pipelineRuns.map((run) => (
                    <Link
                      key={run.id}
                      to={`/pipeline-summary/${run.id}`}
                      className="surface-glass flex items-center gap-4 rounded-[1.75rem] border border-luxe px-5 py-4 transition-all hover:-translate-y-0.5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Pipeline run</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(run.date).toLocaleDateString()}
                          </span>
                          {run.jobRole && <span>{run.jobRole}</span>}
                          <span>CV + Voice + Technical</span>
                        </div>
                      </div>
                      <ScoreRing score={run.score} maxScore={run.maxScore} size={44} strokeWidth={4} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

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
