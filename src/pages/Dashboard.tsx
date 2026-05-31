import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { ReadinessAssessment } from "@/components/ReadinessAssessment";
import { StreakTracker } from "@/components/StreakTracker";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useInterviewStore } from "@/stores/interviewStore";
import { FileText, Mic, Code2, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";

export default function Dashboard() {
  const { getLatestAttempt, getModuleAttempts, getImprovement, pipeline, candidateProfile } =
    useInterviewStore();

  const cvAttempt = getLatestAttempt("cv-screening");
  const voiceAttempt = getLatestAttempt("voice-interview");
  const techAttempt = getLatestAttempt("technical-interview");
  const hasAnyAttempt = cvAttempt || voiceAttempt || techAttempt;
  const interviewsUnlocked = pipeline.cvUploaded && Boolean(candidateProfile?.jobFitSummary);

  const moduleMeta = {
    "cv-screening": { label: "CV", key: "cv", color: "hsl(214 88% 56%)" },
    "voice-interview": { label: "Voice", key: "voice", color: "hsl(159 63% 42%)" },
    "technical-interview": { label: "Technical", key: "technical", color: "hsl(28 88% 56%)" },
  } as const;

  const moduleInsightRows = (["cv-screening", "voice-interview", "technical-interview"] as const)
    .flatMap((mod) => {
      const attempts = getModuleAttempts(mod);
      const latest = attempts[0];
      if (!latest) return [];

      const previous = attempts[1];
      const improvement = getImprovement(mod);
      const { label, key, color } = moduleMeta[mod];

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
        .slice(0, 2);

      const latestRatio = latest.maxScore ? latest.overallScore / latest.maxScore : 0;
      const previousRatio = previous?.maxScore ? previous.overallScore / previous.maxScore : null;
      const delta = previousRatio === null ? null : Math.round((latestRatio - previousRatio) * 100);

      return [{
        mod,
        label,
        key,
        color,
        attempts,
        latest,
        improvement,
        strongestAreas,
        weakestAreas,
        nextActions,
        delta,
      }];
    });

  const progressChartConfig = {
    cv: { label: "CV", color: moduleMeta["cv-screening"].color },
    voice: { label: "Voice", color: moduleMeta["voice-interview"].color },
    technical: { label: "Technical", color: moduleMeta["technical-interview"].color },
    score: { label: "Score" },
  } satisfies ChartConfig;

  const trendSeries = moduleInsightRows.map((item) => ({
    ...item,
    recentAttempts: item.attempts.slice(0, 6).reverse(),
  }));

  const maxTrendLength = trendSeries.length
    ? Math.max(...trendSeries.map((item) => item.recentAttempts.length))
    : 0;

  const trendData = Array.from({ length: maxTrendLength }, (_, index) => {
    const point: Record<string, string | number | null> = {
      attempt: `Run ${index + 1}`,
    };

    trendSeries.forEach((item) => {
      const attempt = item.recentAttempts[index];
      point[item.key] = attempt?.maxScore
        ? Math.round((attempt.overallScore / attempt.maxScore) * 100)
        : null;
    });

    return point;
  });

  const latestScoreData = moduleInsightRows.map((item) => ({
    module: item.label,
    score: item.latest.maxScore ? Math.round((item.latest.overallScore / item.latest.maxScore) * 100) : 0,
    fill: item.color,
  }));

  return (
    <AppLayout>
      <div className="max-w-6xl pb-5 pt-0 md:pb-5 md:pt-0">
        <div
          className="surface-hero noise-overlay relative isolate mb-8 overflow-hidden rounded-[2.5rem] border border-luxe px-6 py-8 opacity-0 animate-fade-up md:px-10 md:py-10"
          style={{ animationFillMode: "forwards" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 z-0 w-1/2 bg-[radial-gradient(circle_at_center,hsl(164_45%_78%/0.18),transparent_48%)]"
          />
          <div className="relative z-10 max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-primary/10 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
              Smooth practice experience
            </div>
            <h1 className="max-w-2xl py-1 font-display text-4xl leading-[1.1] text-gradient md:text-6xl md:leading-[1.08]">
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
            className="mt-8 opacity-0 animate-fade-up"
            style={{ animationDelay: "420ms", animationFillMode: "forwards" }}
          >
            <ReadinessAssessment />
            <div className="mt-4">
              <StreakTracker />
            </div>
          </div>
        )}

        {hasAnyAttempt && (
          <div
            className="mt-10 opacity-0 animate-fade-up"
            style={{ animationDelay: "450ms", animationFillMode: "forwards" }}
          >
            <div className="mb-4">
              <h3 className="font-display text-3xl">Progress insights</h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                A visual read on how each part of your interview prep is trending and where
                your latest scores are strongest.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="surface-glass rounded-[1.75rem] border border-luxe px-5 py-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Score trend</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recent runs across CV, voice, and technical, normalized to 100.
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    Trend
                  </span>
                </div>

                <ChartContainer config={progressChartConfig} className="h-[290px] w-full">
                  <LineChart data={trendData} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="attempt" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent indicator="line" />}
                      cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="cv"
                      stroke="var(--color-cv)"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "var(--color-cv)" }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="voice"
                      stroke="var(--color-voice)"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "var(--color-voice)" }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="technical"
                      stroke="var(--color-technical)"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "var(--color-technical)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>

              <div className="surface-glass rounded-[1.75rem] border border-luxe px-5 py-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Latest score snapshot</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your current standing in each module at a glance.
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    Current
                  </span>
                </div>

                <ChartContainer config={progressChartConfig} className="h-[290px] w-full">
                  <BarChart data={latestScoreData} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="module" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted) / 0.25)" }} />
                    <Bar dataKey="score" radius={[12, 12, 4, 4]}>
                      {latestScoreData.map((entry) => (
                        <Cell key={entry.module} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            <div className="surface-glass mt-4 rounded-[1.75rem] border border-luxe px-5 py-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Coaching readout</p>
                <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Focus
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {moduleInsightRows.map((item) => (
                  <div
                    key={item.mod}
                    className="grid gap-3 py-4 md:grid-cols-[0.8fr_1fr_1fr_1.2fr]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold">{item.label}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.latest.overallScore}/{item.latest.maxScore}
                        {item.delta !== null
                          ? item.delta >= 0
                            ? ` | up ${item.delta} pts`
                            : ` | down ${Math.abs(item.delta)} pts`
                          : " | first scored run"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Best area
                      </div>
                      <div className="mt-1 text-sm leading-6 text-foreground">
                        {item.strongestAreas[0]
                          ? `${item.strongestAreas[0].category} (${item.strongestAreas[0].score}/${item.strongestAreas[0].maxScore})`
                          : "Not enough signal yet."}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Biggest gap
                      </div>
                      <div className="mt-1 text-sm leading-6 text-foreground">
                        {item.weakestAreas[0]
                          ? `${item.weakestAreas[0].category} (${item.weakestAreas[0].score}/${item.weakestAreas[0].maxScore})`
                          : "Not enough signal yet."}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Next focus
                      </div>
                      <div className="mt-1 text-sm leading-6 text-foreground">
                        {item.nextActions.length
                          ? item.nextActions.join(" | ")
                          : "Complete another round to unlock more targeted suggestions."}
                      </div>
                      {(item.improvement?.improved?.length || item.improvement?.needsWork?.length) && (
                        <div className="mt-2 text-xs leading-6 text-muted-foreground">
                          {item.improvement?.improved?.length ? (
                            <div>Improved: {item.improvement.improved.join(", ")}</div>
                          ) : null}
                          {item.improvement?.needsWork?.length ? (
                            <div>Needs work: {item.improvement.needsWork.join(", ")}</div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
