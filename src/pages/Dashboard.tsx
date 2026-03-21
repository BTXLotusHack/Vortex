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
      <div className="px-6 py-8 md:px-10 md:py-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            Interview Preparation
          </h1>
          <p className="mt-2 text-muted-foreground max-w-lg">
            Practice each stage of the interview process. Get scored, receive feedback, and track your improvement over time.
          </p>
        </div>

        {/* Total score card */}
        {hasAnyAttempt && (
          <div
            className="flex flex-col sm:flex-row items-center gap-6 rounded-lg border bg-card p-6 mb-8 opacity-0 animate-fade-up"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <ScoreRing
              score={total.score}
              maxScore={total.max}
              size={96}
              strokeWidth={7}
              label="Overall"
            />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-semibold text-lg">Your Interview Readiness</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Based on your latest attempt across all modules.
                {total.score / total.max >= 0.75
                  ? " You're looking strong — keep refining!"
                  : total.score / total.max >= 0.5
                    ? " Solid progress — focus on the weaker areas."
                    : " Keep practicing — you'll get there!"}
              </p>
            </div>
          </div>
        )}

        {/* Module cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Improvement summary */}
        {hasAnyAttempt && (
          <div
            className="mt-8 space-y-3 opacity-0 animate-fade-up"
            style={{ animationDelay: "450ms", animationFillMode: "forwards" }}
          >
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Progress Insights
            </h3>
            {(["cv-screening", "voice-interview", "technical-interview"] as const).map(
              (mod) => {
                const imp = getImprovement(mod);
                if (!imp) return null;
                const label =
                  mod === "cv-screening"
                    ? "CV"
                    : mod === "voice-interview"
                      ? "Voice"
                      : "Technical";
                return (
                  <div key={mod} className="rounded-md border bg-card px-4 py-3">
                    <p className="text-sm font-medium mb-1">{label}</p>
                    {imp.improved.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-score-high">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Improved: {imp.improved.join(", ")}
                      </div>
                    )}
                    {imp.needsWork.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-score-low">
                        <TrendingDown className="h-3.5 w-3.5" />
                        Needs work: {imp.needsWork.join(", ")}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
