import { useInterviewStore, type ModuleType } from "@/stores/interviewStore";
import { ScoreRing } from "@/components/ScoreRing";
import { CheckCircle2, AlertTriangle, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ReadinessLevel = "not-started" | "early" | "developing" | "strong" | "interview-ready";

interface ReadinessInfo {
  level: ReadinessLevel;
  label: string;
  description: string;
  color: string;
}

const moduleLabels: Record<ModuleType, string> = {
  "cv-screening": "CV Screening",
  "voice-interview": "Voice Interview",
  "technical-interview": "Technical Interview",
};

function computeReadiness(
  scores: { module: ModuleType; pct: number; attempts: number }[],
): ReadinessInfo {
  const completed = scores.filter((s) => s.attempts > 0);
  if (completed.length === 0) {
    return {
      level: "not-started",
      label: "Not Started",
      description: "Begin with CV screening to start your interview preparation journey.",
      color: "text-muted-foreground",
    };
  }

  const avgPct = completed.reduce((sum, s) => sum + s.pct, 0) / completed.length;
  const allModulesDone = completed.length === 3;
  const hasMultipleAttempts = completed.some((s) => s.attempts >= 2);

  if (allModulesDone && avgPct >= 0.75 && hasMultipleAttempts) {
    return {
      level: "interview-ready",
      label: "Interview Ready",
      description: "Strong performance across all modules. You're well-prepared for real interviews.",
      color: "text-score-high",
    };
  }

  if (avgPct >= 0.65 && completed.length >= 2) {
    return {
      level: "strong",
      label: "Strong Progress",
      description: "Good scores across multiple modules. Keep practicing to reach interview-ready status.",
      color: "text-score-high",
    };
  }

  if (avgPct >= 0.45 || completed.length >= 2) {
    return {
      level: "developing",
      label: "Developing",
      description: "Building momentum. Focus on your weakest module to improve overall readiness.",
      color: "text-score-medium",
    };
  }

  return {
    level: "early",
    label: "Getting Started",
    description: "You've taken the first step. Complete more modules to build a full readiness profile.",
    color: "text-score-low",
  };
}

function getTopRecommendations(
  scores: { module: ModuleType; pct: number; attempts: number }[],
): string[] {
  const recommendations: string[] = [];
  const incomplete = scores.filter((s) => s.attempts === 0);
  const completed = scores.filter((s) => s.attempts > 0);

  if (incomplete.length > 0) {
    recommendations.push(
      `Complete ${incomplete.map((s) => moduleLabels[s.module]).join(" and ")} to unlock your full readiness score.`,
    );
  }

  const weakest = [...completed].sort((a, b) => a.pct - b.pct)[0];
  if (weakest && weakest.pct < 0.7) {
    recommendations.push(
      `Focus on ${moduleLabels[weakest.module]} (${Math.round(weakest.pct * 100)}%) — it's your biggest growth opportunity.`,
    );
  }

  const singleAttemptModules = completed.filter((s) => s.attempts === 1);
  if (singleAttemptModules.length > 0) {
    recommendations.push(
      `Retake ${singleAttemptModules.map((s) => moduleLabels[s.module]).join(", ")} to track improvement over time.`,
    );
  }

  if (completed.length === 3 && completed.every((s) => s.pct >= 0.75)) {
    recommendations.push(
      "You're performing well across the board. Consider increasing technical difficulty for an extra challenge.",
    );
  }

  return recommendations.slice(0, 3);
}

export function ReadinessAssessment() {
  const { getLatestAttempt, getModuleAttempts } = useInterviewStore();

  const modules: ModuleType[] = ["cv-screening", "voice-interview", "technical-interview"];
  const scores = modules.map((module) => {
    const latest = getLatestAttempt(module);
    return {
      module,
      pct: latest && latest.maxScore > 0 ? latest.overallScore / latest.maxScore : 0,
      attempts: getModuleAttempts(module).length,
    };
  });

  const completed = scores.filter((s) => s.attempts > 0);
  if (completed.length === 0) return null;

  const totalScore = completed.reduce((sum, s) => sum + s.pct, 0);
  const readinessScore = Math.round((totalScore / 3) * 100);
  const readiness = computeReadiness(scores);
  const recommendations = getTopRecommendations(scores);

  return (
    <div className="surface-glass rounded-[1.75rem] border border-luxe px-6 py-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Interview Readiness</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Overall preparedness based on all module scores.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Assessment
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:gap-8">
        <ScoreRing
          score={readinessScore}
          maxScore={100}
          size={100}
          strokeWidth={8}
          label="Readiness"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {readiness.level === "interview-ready" ? (
              <CheckCircle2 className={cn("h-5 w-5", readiness.color)} />
            ) : readiness.level === "not-started" ? (
              <Target className={cn("h-5 w-5", readiness.color)} />
            ) : (
              <TrendingUp className={cn("h-5 w-5", readiness.color)} />
            )}
            <span className={cn("text-sm font-semibold", readiness.color)}>
              {readiness.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-6 mb-3">
            {readiness.description}
          </p>

          <div className="flex gap-4 mb-4">
            {scores.map((s) => (
              <div key={s.module} className="text-center">
                <div className="text-xs text-muted-foreground mb-1">
                  {moduleLabels[s.module].split(" ")[0]}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    s.attempts === 0
                      ? "text-muted-foreground"
                      : s.pct >= 0.75
                        ? "text-score-high"
                        : s.pct >= 0.5
                          ? "text-score-medium"
                          : "text-score-low",
                  )}
                >
                  {s.attempts > 0 ? `${Math.round(s.pct * 100)}%` : "—"}
                </div>
              </div>
            ))}
          </div>

          {recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Recommendations
              </div>
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-score-medium" />
                  <p className="text-xs text-muted-foreground leading-5">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
