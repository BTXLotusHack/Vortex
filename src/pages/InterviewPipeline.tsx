import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { analyzeCV, analyzeUploadedCV, requestCVUploadUrl, uploadCVToPresignedUrl, type CVAnalysisResult } from "@/lib/api";
import { useInterviewStore, type AttemptResult, type FeedbackItem, type ModuleType } from "@/stores/interviewStore";
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, FileText, Loader2, Mic, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UploadStep = "idle" | "requesting-url" | "uploading" | "analyzing";

function buildTechnicalBrief(jobDescription: string, result: CVAnalysisResult | null) {
  const profile = result?.candidateProfile;
  const parts = [
    jobDescription.trim() ? `Job description:\n${jobDescription.trim()}` : "",
    profile?.summary ? `Candidate summary:\n${profile.summary}` : "",
    profile?.likelySkills?.length ? `Likely skills: ${profile.likelySkills.join(", ")}` : "",
    profile?.strengths?.length ? `Strengths: ${profile.strengths.join(", ")}` : "",
    profile?.risks?.length ? `Risks: ${profile.risks.join(", ")}` : "",
    result?.insights?.nextSteps?.length ? `Development gaps: ${result.insights.nextSteps.join(", ")}` : "",
    "Generate questions at a difficulty aligned with the role, job requirements, and candidate skill ceiling.",
  ];

  return parts.filter(Boolean).join("\n\n");
}

function getModuleLabel(module: ModuleType) {
  switch (module) {
    case "cv-screening":
      return "CV";
    case "voice-interview":
      return "Voice";
    case "technical-interview":
      return "Technical";
  }
}

function getModuleSurface(module: ModuleType) {
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

export default function InterviewPipeline() {
  const navigate = useNavigate();
  const showFinalSummary = false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CVAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");

  const {
    currentJobRole,
    currentJobDescription,
    latestCVAnalysis,
    candidateProfile,
    pipeline,
    getLatestAttempt,
    addAttempt,
    setJobRole,
    setJobDescription,
    setCandidateProfile,
    setLatestCVAnalysis,
    updatePipeline,
    setLatestCVContext,
  } = useInterviewStore();

  const cvAttempt = getLatestAttempt("cv-screening");
  const voiceAttempt = getLatestAttempt("voice-interview");
  const technicalAttempt = getLatestAttempt("technical-interview");

  const savedAnalysis = latestCVAnalysis;
  const visibleAnalysis = result
    ? {
        overallScore: result.overallScore,
        insights: result.insights,
        candidateProfile: result.candidateProfile || null,
      }
    : savedAnalysis;
  const profile = visibleAnalysis?.candidateProfile || candidateProfile;
  const technicalBrief = useMemo(
    () =>
      buildTechnicalBrief(
        currentJobDescription,
        result || (savedAnalysis
          ? {
              overallScore: savedAnalysis.overallScore,
              feedback: [],
              insights: savedAnalysis.insights,
              candidateProfile: savedAnalysis.candidateProfile || undefined,
            }
          : null)
      ),
    [currentJobDescription, result, savedAnalysis]
  );
  const pipelineComplete =
    Boolean(cvAttempt) &&
    Boolean(voiceAttempt) &&
    Boolean(technicalAttempt);
  const pipelineAttempts = [cvAttempt, voiceAttempt, technicalAttempt].filter(
    (attempt): attempt is AttemptResult => Boolean(attempt)
  );
  const totalPoints = pipelineAttempts.reduce(
    (acc, attempt) => {
      acc.score += attempt.overallScore;
      acc.max += attempt.maxScore;
      return acc;
    },
    { score: 0, max: 0 }
  );
  const allFeedback = pipelineAttempts.flatMap((attempt) => attempt.feedback);
  const strongestSignals = [...allFeedback]
    .sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)
    .slice(0, 4);
  const weakestSignals = [...allFeedback]
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 4);
  const improvementActions = allFeedback
    .flatMap((item) => item.suggestions.map((suggestion) => `${item.category}: ${suggestion}`))
    .slice(0, 6);
  const totalCoverage = totalPoints.max ? Math.round((totalPoints.score / totalPoints.max) * 100) : 0;
  const totalLostPoints = Math.max(totalPoints.max - totalPoints.score, 0);
  const expectedAnswerGaps = allFeedback.reduce(
    (count, item) => count + splitSuggestionDetails(item.suggestions).expectedAnswerPoints.length,
    0
  );
  const stageBreakdowns = pipelineAttempts.map((attempt) => {
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
  const handleFile = (selected: File) => {
    if (selected.type === "application/pdf" || selected.name.endsWith(".pdf") || selected.name.endsWith(".docx")) {
      setFile(selected);
    } else {
      toast.error("Please upload a PDF or DOCX CV.");
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Upload a CV first.");
      return;
    }
    if (!currentJobRole.trim()) {
      toast.error("Add the target role before analyzing.");
      return;
    }
    if (!currentJobDescription.trim()) {
      toast.error("Paste the job description before analyzing the CV.");
      return;
    }

    setAnalyzing(true);
    setUploadProgress(0);
    try {
      setUploadStep("requesting-url");
      const presigned = await requestCVUploadUrl(file);

      let response: CVAnalysisResult;
      if (presigned) {
        setUploadStep("uploading");
        await uploadCVToPresignedUrl(file, presigned, setUploadProgress);
        setUploadStep("analyzing");
        response =
          (await analyzeUploadedCV({
            fileUrl: presigned.fileUrl,
            key: presigned.key,
            fileName: file.name,
            jobRole: currentJobRole,
            jobDescription: currentJobDescription,
          })) ||
          (await analyzeCV(file, {
            jobRole: currentJobRole,
            jobDescription: currentJobDescription,
          }));
      } else {
        setUploadStep("analyzing");
        response = await analyzeCV(file, {
          jobRole: currentJobRole,
          jobDescription: currentJobDescription,
        });
      }

      setResult(response);
      const sessionId = crypto.randomUUID();
      const normalizedFeedback: FeedbackItem[] = [
        ...response.feedback,
        ...(response.insights
          ? [{
              category: "Process Insight",
              score: Math.max(0, Math.min(25, Math.round(response.overallScore / 4))),
              maxScore: 25,
              comment: `Strengths: ${response.insights.strengths.join("; ") || "N/A"} | Risks: ${response.insights.risks.join("; ") || "N/A"}`,
              suggestions: response.insights.nextSteps,
            }]
          : []),
      ];
      setCandidateProfile(response.candidateProfile || null);
      setLatestCVAnalysis({
        overallScore: response.overallScore,
        insights: response.insights,
        candidateProfile: response.candidateProfile || null,
      });
      setLatestCVContext({ fileName: file.name, score: response.overallScore });
      updatePipeline({
        active: true,
        cvUploaded: true,
        voiceRequired: true,
        technicalRequired: true,
        recommendedNextStep: "voice",
        lastCompletedStep: "cv",
        currentSessionId: sessionId,
      });
      addAttempt({
        id: crypto.randomUUID(),
        module: "cv-screening",
        date: new Date().toISOString(),
        overallScore: response.overallScore,
        maxScore: 100,
        feedback: normalizedFeedback,
        jobRole: currentJobRole,
        jobDescription: currentJobDescription,
        pipelineSessionId: sessionId,
      });
    } catch (error) {
      console.error(error);
      toast.error("Could not analyze the CV. Please try again.");
    } finally {
      setAnalyzing(false);
      setUploadStep("idle");
    }
  };

  const launchVoice = () => {
    if (!result && !pipeline.cvUploaded) {
      toast.error("Analyze the CV first so the voice interview has context.");
      return;
    }
    updatePipeline({
      active: true,
      recommendedNextStep: "voice",
      voiceRequired: true,
      technicalRequired: true,
    });
    navigate("/voice-interview?from=pipeline");
  };

  const launchTechnical = () => {
    if (!result && !pipeline.cvUploaded) {
      toast.error("Analyze the CV first so the technical interview can be tailored.");
      return;
    }
    updatePipeline({
      active: true,
      recommendedNextStep: "technical",
      voiceRequired: true,
      technicalRequired: true,
    });
    navigate("/technical-interview?from=pipeline");
  };

  return (
    <AppLayout>
      <div className="max-w-7xl pb-5 pt-0 md:pb-5 md:pt-0">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <div
          className="surface-hero noise-overlay relative mb-8 overflow-hidden rounded-[2.5rem] border border-luxe px-6 py-8 opacity-0 animate-fade-up md:px-10 md:py-10"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,hsl(164_45%_78%/0.18),transparent_48%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-primary/10 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
              Guided hiring pipeline
            </div>
            <h1 className="max-w-2xl font-display text-4xl leading-[0.98] text-gradient md:text-6xl">
              Start with the CV, then branch into voice and technical rounds.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              This flow uses the CV and job description first, then lets you optionally run a voice conversation and a technical round with difficulty matched to the role.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="surface-glass rounded-[2rem] border border-luxe p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Step 1</p>
                  <h2 className="mt-2 text-xl font-semibold">Role, JD, and CV context</h2>
                </div>
                {pipeline.cvUploaded && <CheckCircle2 className="h-5 w-5 text-score-high" />}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Target role</label>
                  <input
                    type="text"
                    value={currentJobRole}
                    onChange={(event) => setJobRole(event.target.value)}
                    className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Job description</label>
                  <textarea
                    value={currentJobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    rows={7}
                    className="w-full rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Paste the JD here so the AI can calibrate the interview difficulty, topics, and expectations."
                  />
                </div>

                <div
                  className={cn(
                    "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
                    file ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = event.dataTransfer.files[0];
                    if (dropped) handleFile(dropped);
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (selected) handleFile(selected);
                    }}
                  />
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-10 w-10 text-primary" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(0)} KB ready for CV analysis
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Upload the candidate CV</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">PDF and DOCX are supported</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!file || analyzing}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
                    "disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing CV
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" /> Analyze CV and unlock the flow
                    </>
                  )}
                </button>

                {analyzing && (
                  <div className="rounded-xl border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {uploadStep === "requesting-url" && "Requesting secure upload URL..."}
                        {uploadStep === "uploading" && "Uploading CV..."}
                        {uploadStep === "analyzing" && "Building candidate profile and recommendations..."}
                      </span>
                      <span className="tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.max(uploadProgress, uploadStep === "analyzing" ? 100 : 10)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(visibleAnalysis || profile) && (
              <div className="surface-glass rounded-[2rem] border border-luxe p-6">
                <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <ScoreRing score={visibleAnalysis?.overallScore || 0} maxScore={100} size={94} strokeWidth={7} label="CV" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">AI profile</p>
                    <h2 className="mt-2 text-xl font-semibold">Candidate snapshot from CV + role context</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {profile?.summary || "The CV has been analyzed and is ready to drive the next interview stage."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-score-high/10 px-4 py-4">
                    <p className="text-sm font-semibold text-score-high">Strengths</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profile?.strengths?.join(", ") || visibleAnalysis?.insights?.strengths?.join(", ") || "Not available yet."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-score-low/10 px-4 py-4">
                    <p className="text-sm font-semibold text-score-low">Risks</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profile?.risks?.join(", ") || visibleAnalysis?.insights?.risks?.join(", ") || "Not available yet."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 px-4 py-4">
                    <p className="text-sm font-semibold text-primary">Likely skills</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profile?.likelySkills?.join(", ") || "No skill extraction yet."}
                    </p>
                  </div>
                </div>

                {profile?.jobFitSummary && (
                  <div className="mt-4 rounded-2xl border bg-card px-4 py-4">
                    <p className="text-sm font-semibold">CV to JD fit</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {(profile.jobFitScore ?? 0) > 0 ? `${profile.jobFitScore}/100` : "Estimated"}
                      </span>{" "}
                      {profile.jobFitVerdict ? `• ${profile.jobFitVerdict}` : ""} • {profile.jobFitSummary}
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

          <div className="space-y-6">
            <div className="surface-glass rounded-[2rem] border border-luxe p-6">
              <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Flow status</p>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <span className="text-sm font-medium">CV analyzed</span>
                  <span className={cn("text-sm", pipeline.cvUploaded ? "text-score-high" : "text-muted-foreground")}>
                    {pipeline.cvUploaded ? "Ready" : "Waiting"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <span className="text-sm font-medium">Voice round</span>
                  <span className="text-sm text-muted-foreground">
                    {!pipeline.cvUploaded ? "Locked until CV is done" : voiceAttempt ? "Completed" : "Ready to start"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <span className="text-sm font-medium">Technical round</span>
                  <span className="text-sm text-muted-foreground">
                    {!pipeline.cvUploaded ? "Locked until CV is done" : technicalAttempt ? "Completed" : "Ready to start"}
                  </span>
                </div>
              </div>

              {technicalBrief && (
                <div className="mt-5 rounded-2xl border bg-card px-4 py-4">
                  <p className="text-sm font-semibold">Technical generator context</p>
                  <p className="mt-2 line-clamp-6 text-sm leading-6 text-muted-foreground">
                    {technicalBrief}
                  </p>
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-primary/10 px-4 py-4">
                <p className="text-sm font-semibold text-primary">Recommended next move</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {pipeline.cvUploaded
                    ? !voiceAttempt
                      ? "Run the voice round first so the candidate’s behavior and communication can inform how you interpret the technical stage."
                      : !technicalAttempt
                        ? "Move into the technical round now. It already has enough context from the CV and JD to stay role-calibrated."
                        : "All 3 pipeline stages are complete. You can review results or rerun any stage as needed."
                    : "Start the flow, upload the CV, and paste the job description to unlock tailored interviews."}
                </p>
              </div>

              <Link
                to="/results"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary transition-transform hover:translate-x-0.5"
              >
                Review full results <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="surface-glass rounded-[2rem] border border-luxe p-6">
              <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Step 2</p>
              <h2 className="mt-2 text-xl font-semibold">Continue with the full interview pipeline</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                This pipeline always runs in 3 parts: CV screening, voice interview, and technical interview. Voice and
                technical open only after the CV screening is completed.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-stretch">
                <div className="flex h-full flex-col rounded-[1.75rem] border bg-card px-4 py-4">
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mic className="h-4 w-4 text-primary" /> Voice interview
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Assess communication, behavioral depth, and live interview presence after the CV baseline is set.
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                      {!pipeline.cvUploaded ? "Locked" : voiceAttempt ? "Completed" : "Ready"}
                    </span>
                  </div>
                  <button
                    onClick={launchVoice}
                    disabled={!pipeline.cvUploaded}
                    className={cn(
                      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "disabled:cursor-not-allowed disabled:opacity-40"
                    )}
                  >
                    <Mic className="h-4 w-4" /> {voiceAttempt ? "Redo Voice Interview" : "Start Voice Interview"}
                  </button>
                </div>

                <div className="flex h-full flex-col rounded-[1.75rem] border bg-card px-4 py-4">
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Code2 className="h-4 w-4 text-primary" /> Technical interview
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Test role-matched technical fundamentals and problem solving with questions calibrated from the CV and JD.
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                      {!pipeline.cvUploaded ? "Locked" : technicalAttempt ? "Completed" : "Ready"}
                    </span>
                  </div>
                  <button
                    onClick={launchTechnical}
                    disabled={!pipeline.cvUploaded}
                    className={cn(
                      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all hover:bg-secondary",
                      "disabled:cursor-not-allowed disabled:opacity-40"
                    )}
                  >
                    <Code2 className="h-4 w-4" /> {technicalAttempt ? "Redo Technical Interview" : "Start Technical Interview"}
                  </button>
                </div>
              </div>
            </div>

            {showFinalSummary && pipelineComplete && (
              <div className="surface-glass rounded-[2rem] border border-luxe p-6">
                <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                  Final Summary
                </p>
                <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <ScoreRing
                    score={totalPoints.score}
                    maxScore={Math.max(totalPoints.max, 1)}
                    size={96}
                    strokeWidth={7}
                    label="Total"
                  />
                  <div>
                    <h2 className="text-xl font-semibold">Completed pipeline score</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {totalPoints.score}/{totalPoints.max} across the completed stages in this pipeline.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {pipelineAttempts.map((attempt) => (
                    <div key={attempt!.id} className="rounded-2xl bg-card px-4 py-4">
                      <p className="text-sm font-semibold">
                        {attempt!.module === "cv-screening"
                          ? "CV"
                          : attempt!.module === "voice-interview"
                            ? "Voice"
                            : "Technical"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {attempt!.overallScore}/{attempt!.maxScore}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-score-high/10 px-4 py-4">
                    <p className="text-sm font-semibold text-score-high">What you were good at</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {strongestSignals.length
                        ? strongestSignals
                            .map((item) => `${item.category} (${item.score}/${item.maxScore})`)
                            .join(", ")
                        : "No strong signals available yet."}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-score-low/10 px-4 py-4">
                    <p className="text-sm font-semibold text-score-low">Where you lost points</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {weakestSignals.length
                        ? weakestSignals
                            .map((item) => `${item.category} (${item.score}/${item.maxScore})`)
                            .join(", ")
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
          </div>
        </div>

        {showFinalSummary && pipelineComplete && (
          <div className="surface-glass mt-6 rounded-[2rem] border border-luxe p-6">
            <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Final Summary</p>

            <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <ScoreRing
                  score={totalPoints.score}
                  maxScore={Math.max(totalPoints.max, 1)}
                  size={102}
                  strokeWidth={7}
                  label="Total"
                />
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold">Completed pipeline score</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {totalPoints.score}/{totalPoints.max} across the completed stages in this pipeline. This report shows
                    where points were lost, which categories were weakest, and the expected answer points when they were
                    captured by the evaluator.
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
                <div key={attempt.id} className={cn("rounded-[1.75rem] border px-4 py-4", getModuleSurface(attempt.module))}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{getModuleLabel(attempt.module)}</p>
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
                      <h3 className="mt-2 text-lg font-semibold">{getModuleLabel(attempt.module)} stage</h3>
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
      </div>
    </AppLayout>
  );
}
