import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { analyzeCV, analyzeUploadedCV, requestCVUploadUrl, uploadCVToPresignedUrl, type CVAnalysisResult } from "@/lib/api";
import { useInterviewStore } from "@/stores/interviewStore";
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

export default function InterviewPipeline() {
  const navigate = useNavigate();
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
    setJobRole,
    setJobDescription,
    setCandidateProfile,
    setLatestCVAnalysis,
    updatePipeline,
    setLatestCVContext,
  } = useInterviewStore();

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
        recommendedNextStep: pipeline.voiceRequired ? "voice" : pipeline.technicalRequired ? "technical" : "complete",
        lastCompletedStep: "cv",
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
      technicalRequired: pipeline.technicalRequired,
    });
    navigate("/voice-interview?from=pipeline");
  };

  const launchTechnical = () => {
    if (!result && !pipeline.cvUploaded) {
      toast.error("Analyze the CV first so the technical interview can be tailored.");
      return;
    }
    navigate("/technical-interview?from=pipeline");
  };

  return (
    <AppLayout>
      <div className="max-w-5xl pb-5 pt-0 md:pb-5 md:pt-0">
        <Link
          to="/"
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

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
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

                <div className="grid gap-4 md:grid-cols-3">
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
              <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Step 2</p>
              <h2 className="mt-2 text-xl font-semibold">Choose the interview path</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Voice and technical rounds are optional. The technical round can still be generated from the CV and JD alone, but voice gives you an additional behavioral signal before deeper testing.
              </p>

              <div className="mt-5 space-y-4">
                <label className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-4">
                  <input
                    type="checkbox"
                    checked={pipeline.voiceRequired}
                    onChange={(event) =>
                      updatePipeline({
                        voiceRequired: event.target.checked,
                        recommendedNextStep: event.target.checked ? "voice" : "technical",
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Mic className="h-4 w-4 text-primary" /> Voice interview
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Use ElevenAgents-style live conversation to probe communication, composure, and behavioral fit.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-4">
                  <input
                    type="checkbox"
                    checked={pipeline.technicalRequired}
                    onChange={(event) => updatePipeline({ technicalRequired: event.target.checked })}
                    className="mt-1 h-4 w-4 rounded border"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Code2 className="h-4 w-4 text-primary" /> Technical interview
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Generate role-matched questions from the JD and the candidate skill signals already extracted from the CV.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={launchVoice}
                  disabled={!pipeline.cvUploaded || !pipeline.voiceRequired}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  <Mic className="h-4 w-4" /> Continue to Voice Interview
                </button>
                <button
                  onClick={launchTechnical}
                  disabled={!pipeline.cvUploaded || !pipeline.technicalRequired}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all hover:bg-secondary",
                    "disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  <Code2 className="h-4 w-4" /> Skip ahead to Technical Interview
                </button>
              </div>
            </div>

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
                    {!pipeline.voiceRequired ? "Skipped" : voiceAttempt ? "Completed" : "Optional next"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <span className="text-sm font-medium">Technical round</span>
                  <span className="text-sm text-muted-foreground">
                    {!pipeline.technicalRequired ? "Skipped" : technicalAttempt ? "Completed" : "Pending"}
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
                    ? pipeline.voiceRequired && !voiceAttempt
                      ? "Run the voice round first so the candidate’s behavior and communication can inform how you interpret the technical stage."
                      : pipeline.technicalRequired && !technicalAttempt
                        ? "Move into the technical round now. It already has enough context from the CV and JD to stay role-calibrated."
                        : "This pipeline already has the core inputs it needs. You can review results or rerun stages as needed."
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
