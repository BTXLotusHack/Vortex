import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { ScoreRing } from "@/components/ScoreRing";
import { useInterviewStore } from "@/stores/interviewStore";
import { FileText, Mic, Code2, TrendingUp, TrendingDown } from "lucide-react";

export default function Dashboard() {
  const { getLatestAttempt, getModuleAttempts, getTotalScore, getImprovement } =
    useInterviewStore();

  const cvAttempt = getLatestAttempt("cv-screening");
  const voiceAttempt = getLatestAttempt("voice-interview");
  const techAttempt = getLatestAttempt("technical-interview");
  const total = getTotalScore();

  const hasAnyAttempt = cvAttempt || voiceAttempt || techAttempt;

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
          </div>
        </div>

        {hasAnyAttempt && (
          <div
            className="surface-glass mb-8 flex flex-col items-start gap-6 rounded-[2rem] border border-luxe p-6 opacity-0 animate-fade-up sm:flex-row sm:items-center"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <ScoreRing
              score={total.score}
              maxScore={total.max}
              size={96}
              strokeWidth={7}
              label="Overall"
            />
            <div className="flex-1 text-left">
              <div className="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                Overview
              </div>
              <h2 className="text-xl font-semibold">Your Interview Readiness</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Based on your latest attempt across all modules.
                {total.score / total.max >= 0.75
                  ? " You are in a strong position now, so focus on precision and consistency."
                  : total.score / total.max >= 0.5
                    ? " Momentum is there, and the next gains should come from tightening weaker areas."
                    : " The foundation is still forming, but a few more focused rounds will move things quickly."}
              </p>
            </div>
          </div>
        )}

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
              {(["cv-screening", "voice-interview", "technical-interview"] as const).map(
                (mod) => {
                  const improvement = getImprovement(mod);
                  if (!improvement) return null;

                  const label =
                    mod === "cv-screening"
                      ? "CV"
                      : mod === "voice-interview"
                        ? "Voice"
                        : "Technical";

                  return (
                    <div
                      key={mod}
                      className="surface-glass rounded-[1.75rem] border border-luxe px-5 py-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold">{label}</p>
                        <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                          Signals
                        </span>
                      </div>
                      <div className="space-y-3">
                        {improvement.improved.length > 0 && (
                          <div className="rounded-2xl bg-score-high/10 px-3 py-3 text-sm text-score-high">
                            <div className="mb-1 flex items-center gap-2 font-medium">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Improved
                            </div>
                            <div className="leading-6">{improvement.improved.join(", ")}</div>
                          </div>
                        )}
                        {improvement.needsWork.length > 0 && (
                          <div className="rounded-2xl bg-score-low/10 px-3 py-3 text-sm text-score-low">
                            <div className="mb-1 flex items-center gap-2 font-medium">
                              <TrendingDown className="h-3.5 w-3.5" />
                              Needs work
                            </div>
                            <div className="leading-6">{improvement.needsWork.join(", ")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
