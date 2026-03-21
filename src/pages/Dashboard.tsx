import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { useInterviewStore } from "@/stores/interviewStore";
import { FileText, Mic, Code2, TrendingUp, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { getLatestAttempt, getModuleAttempts, getImprovement, pipeline, candidateProfile } =
    useInterviewStore();

  const cvAttempt = getLatestAttempt("cv-screening");
  const voiceAttempt = getLatestAttempt("voice-interview");
  const techAttempt = getLatestAttempt("technical-interview");
  const hasAnyAttempt = cvAttempt || voiceAttempt || techAttempt;
  const interviewsUnlocked = pipeline.cvUploaded && Boolean(candidateProfile?.jobFitSummary);

  const moduleInsightRows = (["cv-screening", "voice-interview", "technical-interview"] as const)
    .map((mod) => {
      const attempts = getModuleAttempts(mod);
      const latest = attempts[0];
      if (!latest) return null;

      const previous = attempts[1];
      const improvement = getImprovement(mod);
      const label =
        mod === "cv-screening"
          ? "CV"
          : mod === "voice-interview"
            ? "Voice"
            : "Technical";

      const latestFeedback = [...latest.feedback].sort(
        (a, b) => b.score / b.maxScore - a.score / a.maxScore
      );
      const strongestAreas = latestFeedback.slice(0, 2);
      const weakestAreas = [...latestFeedback]
        .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
        .slice(0, 2);
      const nextActions = latest.feedback
        .flatMap((item) => item.suggestions)
        .filter(Boolean)
        .slice(0, 3);

      const latestRatio = latest.maxScore ? latest.overallScore / latest.maxScore : 0;
      const previousRatio = previous?.maxScore ? previous.overallScore / previous.maxScore : null;
      const delta =
        previousRatio === null
          ? null
          : Math.round((latestRatio - previousRatio) * 100);

      return {
        mod,
        label,
        latest,
        previous,
        improvement,
        strongestAreas,
        weakestAreas,
        nextActions,
        delta,
      };
    })
    .filter(Boolean);

  return (
    <AppLayout>
      <div className="max-w-6xl pb-5 pt-0 md:pb-5 md:pt-0">
        <div
          className="surface-hero noise-overlay relative mb-8 overflow-hidden rounded-[2.5rem] border border-luxe px-6 py-8 opacity-0 animate-fade-up md:px-10 md:py-10"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,hsl(164_45%_78%/0.18),transparent_48%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-primary/10 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
              Smooth practice experience
            </div>
            <h1 className="max-w-2xl font-display text-4xl leading-[0.98] text-gradient md:text-6xl">
              Interview prep with a calmer, sharper rhythm.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              Practice every stage of the interview process in one refined workspace,
              with elegant scoring, tailored feedback, and clearer progress signals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-white/55 px-4 py-2">
                CV diagnostics
              </span>
              <span className="rounded-full border border-border/70 bg-white/55 px-4 py-2">
                Voice rehearsal
              </span>
              <span className="rounded-full border border-border/70 bg-white/55 px-4 py-2">
                Technical rounds
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/interview-pipeline"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" /> Start Guided Pipeline
              </Link>
              <Link
                to="/results"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/65 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white"
              >
                View Results <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            title="CV Screening"
            description="Upload your CV for AI analysis. Get feedback on formatting, content, keywords, and ATS compatibility."
            icon={<FileText className="h-5 w-5" />}
            href="/cv-screening"
            lastScore={
              cvAttempt
                ? { score: cvAttempt.overallScore, maxScore: cvAttempt.maxScore }
                : undefined
            }
            attempts={getModuleAttempts("cv-screening").length}
            delay={200}
          />
          <ModuleCard
            title="Voice Interview"
            description="Practice with AI-powered voice questions. Respond naturally and get feedback on your communication."
            icon={<Mic className="h-5 w-5" />}
            href="/voice-interview"
            lastScore={
              voiceAttempt
                ? { score: voiceAttempt.overallScore, maxScore: voiceAttempt.maxScore }
                : undefined
            }
            attempts={getModuleAttempts("voice-interview").length}
            delay={280}
            disabled={!interviewsUnlocked}
            disabledReason="Analyze the CV against the JD first to unlock voice interview access."
          />
          <ModuleCard
            title="Technical Interview"
            description="Test your technical knowledge with role-specific questions. Covers fundamentals to system design."
            icon={<Code2 className="h-5 w-5" />}
            href="/technical-interview"
            lastScore={
              techAttempt
                ? { score: techAttempt.overallScore, maxScore: techAttempt.maxScore }
                : undefined
            }
            attempts={getModuleAttempts("technical-interview").length}
            delay={360}
            disabled={!interviewsUnlocked}
            disabledReason="Analyze the CV against the JD first to unlock technical interview access."
          />
        </div>

        {hasAnyAttempt && (
          <div
            className="mt-10 opacity-0 animate-fade-up"
            style={{ animationDelay: "450ms", animationFillMode: "forwards" }}
          >
            <div className="mb-4">
              <h3 className="font-display text-3xl">Progress insights</h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                A cleaner read on where your performance is compounding and where sharper
                practice would pay off next.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {moduleInsightRows.map((item) => (
                <div
                  key={item.mod}
                  className="surface-glass rounded-[1.75rem] border border-luxe px-5 py-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Latest score {item.latest.overallScore}/{item.latest.maxScore}
                        {item.delta !== null
                          ? item.delta >= 0
                            ? ` • up ${item.delta} pts vs previous`
                            : ` • down ${Math.abs(item.delta)} pts vs previous`
                          : " • first scored attempt"}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Signals
                    </span>
                  </div>

                  <div className="space-y-3">
                    {item.improvement?.improved && item.improvement.improved.length > 0 && (
                      <div className="rounded-2xl bg-score-high/10 px-3 py-3 text-sm text-score-high">
                        <div className="mb-1 flex items-center gap-2 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Improved
                        </div>
                        <div className="leading-6">{item.improvement.improved.join(", ")}</div>
                      </div>
                    )}

                    {item.improvement?.needsWork && item.improvement.needsWork.length > 0 && (
                      <div className="rounded-2xl bg-score-low/10 px-3 py-3 text-sm text-score-low">
                        <div className="mb-1 flex items-center gap-2 font-medium">
                          <TrendingDown className="h-3.5 w-3.5" />
                          Needs work
                        </div>
                        <div className="leading-6">{item.improvement.needsWork.join(", ")}</div>
                      </div>
                    )}

                    <div className="rounded-2xl bg-card px-3 py-3">
                      <div className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Strongest areas
                      </div>
                      <div className="text-sm leading-6 text-foreground">
                        {item.strongestAreas.length
                          ? item.strongestAreas
                              .map((area) => `${area.category} (${area.score}/${area.maxScore})`)
                              .join(", ")
                          : "Not enough signal yet."}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-card px-3 py-3">
                      <div className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Biggest gaps
                      </div>
                      <div className="text-sm leading-6 text-foreground">
                        {item.weakestAreas.length
                          ? item.weakestAreas
                              .map((area) => `${area.category} (${area.score}/${area.maxScore})`)
                              .join(", ")
                          : "Not enough signal yet."}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-card px-3 py-3">
                      <div className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Next focus
                      </div>
                      <div className="text-sm leading-6 text-foreground">
                        {item.nextActions.length
                          ? item.nextActions.join(" • ")
                          : "Complete another round to unlock more targeted suggestions."}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
