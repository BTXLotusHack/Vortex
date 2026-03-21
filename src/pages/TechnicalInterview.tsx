import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { useInterviewStore, type FeedbackItem } from "@/stores/interviewStore";
import { getInterviewQuestions, evaluateAnswer } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  Play,
  ChevronRight,
  Code2,
  Clock,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";

type Question = Awaited<ReturnType<typeof getInterviewQuestions>>[number];
type AnswerEvaluation = Awaited<ReturnType<typeof evaluateAnswer>>;

export default function TechnicalInterview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState<"setup" | "interview" | "results">(
    "setup",
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [questionCount, setQuestionCount] = useState(5);
  const [questionBrief, setQuestionBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [codeAnswer, setCodeAnswer] = useState(
    "function solve(input) {\n  // write your solution\n  return input;\n}",
  );
  const [codeLanguage, setCodeLanguage] = useState<
    "javascript" | "typescript" | "python"
  >("typescript");
  const [answers, setAnswers] = useState<
    Array<{ question: Question; answer: string; evaluation: AnswerEvaluation }>
  >([]);
  const [evaluating, setEvaluating] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  const fromPipeline = searchParams.get("from") === "pipeline";
  const {
    currentJobRole,
    currentJobDescription,
    candidateProfile,
    pipeline,
    setJobRole,
    addAttempt,
    upsertPipelineRun,
    getImprovement,
    updatePipeline,
  } = useInterviewStore();
  const interviewsUnlocked =
    pipeline.cvUploaded && Boolean(candidateProfile?.jobFitSummary);

  const generatedBrief = [
    currentJobDescription.trim()
      ? `Job description:\n${currentJobDescription.trim()}`
      : "",
    candidateProfile?.summary
      ? `Candidate summary:\n${candidateProfile.summary}`
      : "",
    candidateProfile?.likelySkills?.length
      ? `Likely skillset: ${candidateProfile.likelySkills.join(", ")}`
      : "",
    candidateProfile?.strengths?.length
      ? `Observed strengths: ${candidateProfile.strengths.join(", ")}`
      : "",
    candidateProfile?.risks?.length
      ? `Skill gaps or risks: ${candidateProfile.risks.join(", ")}`
      : "",
    candidateProfile?.jobFitSummary
      ? `JD fit assessment: ${candidateProfile.jobFitSummary}`
      : "",
    "Set difficulty to match the role, job requirements, and likely candidate level. Use coding only when it fits the role.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const startInterview = async () => {
    setLoading(true);
    try {
      const qs = await getInterviewQuestions(
        currentJobRole,
        "technical",
        questionCount,
        {
          questionBrief: questionBrief.trim() || generatedBrief || undefined,
        },
      );
      if (!qs.length) {
        toast.error(
          "No questions generated. Please refine your brief and try again.",
        );
        return;
      }
      setQuestions(qs);
      setCurrentQ(0);
      setAnswers([]);
      setTimer(0);
      setStage("interview");
      const interval = setInterval(() => setTimer((t) => t + 1), 1000);
      setTimerInterval(interval);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Cannot generate technical questions right now.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim() && !codeAnswer.trim()) return;
    setEvaluating(true);
    const q = questions[currentQ];
    const requiresCoding = Boolean(q.requiresCoding);
    const composedAnswer = [
      userAnswer.trim() ? `Approach:\n${userAnswer.trim()}` : "",
      requiresCoding && codeAnswer.trim()
        ? `Code (${codeLanguage}):\n${codeAnswer.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const evaluation = await evaluateAnswer(
        q.id,
        composedAnswer,
        q.expectedPoints,
        {
          type: "technical",
          question: q.question,
          difficulty: q.difficulty,
          requiresCoding,
        },
      );
      const newAnswers = [
        ...answers,
        { question: q, answer: composedAnswer, evaluation },
      ];
      setAnswers(newAnswers);
      setUserAnswer("");
      setCodeAnswer(
        currentQ < questions.length - 1 &&
          questions[currentQ + 1]?.requiresCoding
          ? "function solve(input) {\n  // write your solution\n  return input;\n}"
          : "",
      );

      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        if (timerInterval) clearInterval(timerInterval);
        const totalScore = newAnswers.reduce(
          (s, a) => s + a.evaluation.score,
          0,
        );
        const maxScore = newAnswers.reduce(
          (s, a) => s + a.evaluation.maxScore,
          0,
        );
        const feedback: FeedbackItem[] = newAnswers.map((a) => ({
          category: `${a.question.category} (${a.question.difficulty})`,
          score: a.evaluation.score,
          maxScore: a.evaluation.maxScore,
          comment: a.evaluation.feedback,
          suggestions: [
            ...a.evaluation.missedPoints.map((p: string) => `Missing: ${p}`),
            ...(a.evaluation.processInsight?.nextSteps || []),
          ],
        }));

        addAttempt({
          id: crypto.randomUUID(),
          module: "technical-interview",
          date: new Date().toISOString(),
          overallScore: totalScore,
          maxScore,
          feedback,
          jobRole: currentJobRole,
          jobDescription: currentJobDescription,
          duration: timer,
          pipelineSessionId: fromPipeline ? pipeline.currentSessionId : undefined,
        });
        if (fromPipeline) {
          updatePipeline({
            active: true,
            lastCompletedStep: "technical",
            recommendedNextStep: "complete",
          });
          if (pipeline.currentSessionId) {
            const pipelineRun = upsertPipelineRun(pipeline.currentSessionId);
            if (pipelineRun) {
              navigate(`/pipeline-summary/${pipelineRun.id}`);
              return;
            }
          }
        }
        setStage("results");
      }
    } finally {
      setEvaluating(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const latestFeedback =
    stage === "results"
      ? answers.map((a) => ({
          category: `${a.question.category} (${a.question.difficulty})`,
          score: a.evaluation.score,
          maxScore: a.evaluation.maxScore,
          comment: a.evaluation.feedback,
          suggestions: [
            ...a.evaluation.missedPoints.map((p: string) => `Missing: ${p}`),
            ...(a.evaluation.processInsight?.nextSteps || []),
          ],
        }))
      : [];

  const totalScore = answers.reduce(
    (s, a) => s + (a.evaluation?.score || 0),
    0,
  );
  const totalMax = answers.reduce(
    (s, a) => s + (a.evaluation?.maxScore || 0),
    0,
  );
  const improvement = getImprovement("technical-interview");

  return (
    <AppLayout>
      <div className="px-6 py-8 md:px-10 md:py-10 max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        {!interviewsUnlocked && (
          <div className="rounded-lg border bg-card p-6">
            <h1 className="text-2xl font-bold">Technical Interview Locked</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Candidates must complete CV analysis against the job description
              before technical questions can be generated. The system uses that
              fit assessment to set the topic coverage and difficulty.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/interview-pipeline"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start CV + JD Analysis
              </Link>
              <Link
                to="/cv-screening"
                className="rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Go to CV Screening
              </Link>
            </div>
          </div>
        )}

        {interviewsUnlocked && stage === "setup" && (
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationFillMode: "forwards" }}
          >
            <h1 className="text-2xl font-bold mb-2">Technical Interview</h1>
            <p className="text-muted-foreground mb-8">
              Test your technical knowledge with role-specific questions
              covering fundamentals, frameworks, and system design.
            </p>

            {fromPipeline && (
              <div className="mb-6 rounded-lg border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
                This round is being generated from the pipeline context, so the
                technical depth is calibrated from the CV, the job description,
                and the inferred skill set.
              </div>
            )}

            {candidateProfile?.jobFitSummary && (
              <div className="mb-6 rounded-lg border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
                JD fit:{" "}
                <span className="font-medium text-foreground">
                  {candidateProfile.jobFitVerdict || "partial-fit"}
                </span>
                . {candidateProfile.jobFitSummary}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Target Role
                </label>
                <input
                  type="text"
                  value={currentJobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Frontend Developer"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={questionCount}
                  onChange={(e) =>
                    setQuestionCount(
                      Math.max(1, Math.min(10, Number(e.target.value) || 5)),
                    )
                  }
                  title="Number of interview questions"
                  placeholder="5"
                  className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Question Brief (optional)
                </label>
                <textarea
                  value={questionBrief}
                  onChange={(e) => setQuestionBrief(e.target.value)}
                  rows={3}
                  placeholder={
                    fromPipeline
                      ? "Optional override. Leave blank to use the CV + JD context automatically."
                      : "Paste your required question topics here (e.g. React hooks + async race conditions + coding on debounce)."
                  }
                  title="Custom question brief"
                  className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <button
                onClick={startInterview}
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3",
                  "bg-primary text-primary-foreground font-medium text-sm",
                  "hover:bg-primary/90 active:scale-[0.98] transition-all",
                  "disabled:opacity-40",
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                    questions…
                  </>
                ) : (
                  <>
                    <Code2 className="h-4 w-4" /> Start Technical Interview
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {stage === "interview" && questions[currentQ] && (
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationFillMode: "forwards" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-8 rounded-full transition-colors duration-300",
                      i < currentQ
                        ? "bg-primary"
                        : i === currentQ
                          ? "bg-primary/50"
                          : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(timer)}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {questions[currentQ].category}
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  questions[currentQ].difficulty === "easy"
                    ? "bg-score-high/10 text-score-high"
                    : questions[currentQ].difficulty === "medium"
                      ? "bg-score-medium/10 text-score-medium"
                      : "bg-score-low/10 text-score-low",
                )}
              >
                {questions[currentQ].difficulty}
              </span>
            </div>

            <h2 className="text-xl font-semibold mb-6 leading-snug">
              {questions[currentQ].question}
            </h2>

            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Explain your reasoning, edge cases, and trade-offs..."
              rows={4}
              className="w-full rounded-lg border bg-card px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />

            {questions[currentQ].requiresCoding ? (
              <div className="rounded-lg border bg-card p-3 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Live Coding Challenge
                  </span>
                  <select
                    value={codeLanguage}
                    onChange={(e) =>
                      setCodeLanguage(
                        e.target.value as
                          | "javascript"
                          | "typescript"
                          | "python",
                      )
                    }
                    aria-label="Select code language"
                    title="Select code language"
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                  </select>
                </div>
                <Editor
                  height="320px"
                  language={codeLanguage}
                  theme="light"
                  value={codeAnswer}
                  onChange={(value) => setCodeAnswer(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: "on",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                This question focuses on reasoning. Monaco editor is hidden
                because coding is not required.
              </div>
            )}

            <button
              onClick={submitAnswer}
              disabled={
                evaluating ||
                (!questions[currentQ].requiresCoding && !userAnswer.trim()) ||
                (questions[currentQ].requiresCoding &&
                  !userAnswer.trim() &&
                  !codeAnswer.trim())
              }
              className={cn(
                "mt-4 w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3",
                "bg-primary text-primary-foreground font-medium text-sm",
                "hover:bg-primary/90 active:scale-[0.98] transition-all",
                "disabled:opacity-40",
              )}
            >
              {evaluating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Evaluating…
                </>
              ) : currentQ < questions.length - 1 ? (
                <>
                  <ChevronRight className="h-4 w-4" /> Next Question
                </>
              ) : (
                "Finish Interview"
              )}
            </button>
          </div>
        )}

        {stage === "results" && (
          <div>
            <div
              className="flex flex-col sm:flex-row items-center gap-6 rounded-lg border bg-card p-6 mb-6 opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards" }}
            >
              <ScoreRing
                score={totalScore}
                maxScore={totalMax}
                size={110}
                strokeWidth={8}
              />
              <div className="text-center sm:text-left">
                <h2 className="text-lg font-semibold">Technical Score</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Completed in {formatTime(timer)}.{" "}
                  {totalScore / totalMax >= 0.75
                    ? "Strong technical knowledge!"
                    : totalScore / totalMax >= 0.5
                      ? "Good foundation — review the gaps below."
                      : "Brush up on the fundamentals and try again."}
                </p>
                {improvement && (
                  <div className="mt-2 text-xs space-y-0.5">
                    {improvement.improved.length > 0 && (
                      <p className="text-score-high">
                        ↑ Improved: {improvement.improved.join(", ")}
                      </p>
                    )}
                    {improvement.needsWork.length > 0 && (
                      <p className="text-score-low">
                        ↓ Needs work: {improvement.needsWork.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <FeedbackPanel feedback={latestFeedback} />

            <button
              onClick={() => {
                setStage("setup");
                setTimer(0);
              }}
              className="mt-6 w-full rounded-lg border px-6 py-3 text-sm font-medium hover:bg-secondary transition-colors active:scale-[0.98]"
            >
              Try Again
            </button>

            {fromPipeline && (
              <Link
                to="/interview-pipeline"
                className="mt-3 flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Return to Pipeline Overview
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
