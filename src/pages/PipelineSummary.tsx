import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { cn } from "@/lib/utils";
import { useInterviewStore, type AttemptResult, type FeedbackItem, type ModuleType } from "@/stores/interviewStore";

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

export default function PipelineSummary() {
  const { runId } = useParams();
  const { getPipelineRun, getPipelineAttempts } = useInterviewStore();

  const pipelineRun = runId ? getPipelineRun(runId) : undefined;
  const attempts = runId ? getPipelineAttempts(runId) : [];

  if (!pipelineRun || attempts.length !== 3) {
    return (
      <AppLayout>
        <div className="max-w-5xl pb-5 pt-0 md:pb-5 md:pt-0">
          <Link
            to="/results"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Results
          </Link>

          <div className="surface-glass rounded-[2rem] border border-luxe p-8">
            <h1 className="text-2xl font-semibold">Pipeline summary not found</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              This pipeline run is no longer available. Go back to Results to review the available history.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const totals = attempts.reduce(
    (acc, attempt) => {
      acc.score += attempt.overallScore;
      acc.max += attempt.maxScore;
      return acc;
    },
    { score: 0, max: 0 }
  );
  const allFeedback = attempts.flatMap((attempt) => attempt.feedback);
  const strongestSignals = [...allFeedback]
    .sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)
    .slice(0, 4);
  const weakestSignals = [...allFeedback]
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 4);
  const improvementActions = allFeedback
    .flatMap((item) => item.suggestions.map((suggestion) => `${item.category}: ${suggestion}`))
    .slice(0, 6);
  const totalCoverage = totals.max ? Math.round((totals.score / totals.max) * 100) : 0;
  const totalLostPoints = Math.max(totals.max - totals.score, 0);
  const expectedAnswerGaps = allFeedback.reduce(
    (count, item) => count + splitSuggestionDetails(item.suggestions).expectedAnswerPoints.length,
    0
  );
  const stageBreakdowns = attempts.map((attempt: AttemptResult) => {
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
      <div className="max-w-6xl pb-5 pt-0 md:pb-5 md:pt-0">
        <Link
          to="/results"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Results
        </Link>

        <div className="surface-glass rounded-[2rem] border border-luxe p-6">
          <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Final Summary</p>

          <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ScoreRing
                score={totals.score}
                maxScore={Math.max(totals.max, 1)}
                size={102}
                strokeWidth={7}
                label="Total"
              />
              <div className="max-w-2xl">
                <h1 className="text-xl font-semibold">Completed pipeline score</h1>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {totals.score}/{totals.max} across this pipeline session only. This summary belongs to the selected
                  run and does not mix in attempts from other sessions.
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  {new Date(pipelineRun.date).toLocaleString()}
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
                <p className="mt-1 text-sm text-muted-foreground">Across this session only</p>
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
              <div key={attempt.id} className={cn("rounded-[1.75rem] border px-4 py-4", getSummaryModuleSurface(attempt.module))}>
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
                    <h2 className="mt-2 text-lg font-semibold">{getSummaryModuleLabel(attempt.module)} stage</h2>
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
      </div>
    </AppLayout>
  );
}
