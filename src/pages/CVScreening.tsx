import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { ScoreRing } from "@/components/ScoreRing";
import { useInterviewStore } from "@/stores/interviewStore";
import { analyzeCV, analyzeUploadedCV, requestCVUploadUrl, uploadCVToPresignedUrl } from "@/lib/api";
import { Upload, FileText, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FeedbackItem } from "@/stores/interviewStore";

export default function CVScreening() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<"idle" | "requesting-url" | "uploading" | "analyzing">("idle");
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzeCV>> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    addAttempt,
    getImprovement,
    currentJobRole,
    currentJobDescription,
    setJobRole,
    setJobDescription,
    setCandidateProfile,
    setLatestCVAnalysis,
    setLatestCVContext,
    updatePipeline,
  } = useInterviewStore();

  const handleFile = (f: File) => {
    if (f.type === "application/pdf" || f.name.endsWith(".pdf") || f.name.endsWith(".docx")) {
      setFile(f);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
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

      let res: Awaited<ReturnType<typeof analyzeCV>>;
      if (presigned) {
        setUploadStep("uploading");
        await uploadCVToPresignedUrl(file, presigned, (progress) => {
          setUploadProgress(progress);
        });

        setUploadStep("analyzing");
        const uploadedResult = await analyzeUploadedCV({
          fileUrl: presigned.fileUrl,
          key: presigned.key,
          fileName: file.name,
          jobRole: currentJobRole,
          jobDescription: currentJobDescription,
        });

        if (uploadedResult) {
          res = uploadedResult;
        } else {
          // Backend has not exposed analyze-by-url yet.
          res = await analyzeCV(file, {
            jobRole: currentJobRole,
            jobDescription: currentJobDescription,
          });
        }
      } else {
        setUploadStep("analyzing");
        res = await analyzeCV(file, {
          jobRole: currentJobRole,
          jobDescription: currentJobDescription,
        });
      }

      const normalizedFeedback: FeedbackItem[] = [
        ...res.feedback,
        ...(res.insights
          ? [{
              category: "Process Insight",
              score: Math.max(0, Math.min(25, Math.round(res.overallScore / 4))),
              maxScore: 25,
              comment: `Strengths: ${res.insights.strengths.join("; ") || "N/A"} | Risks: ${res.insights.risks.join("; ") || "N/A"}`,
              suggestions: res.insights.nextSteps,
            }]
          : []),
      ];

      setResult(res);
      setCandidateProfile(res.candidateProfile || null);
      setLatestCVAnalysis({
        overallScore: res.overallScore,
        insights: res.insights,
        candidateProfile: res.candidateProfile || null,
      });
      setLatestCVContext({ fileName: file.name, score: res.overallScore });
      updatePipeline({
        active: true,
        cvUploaded: true,
        lastCompletedStep: "cv",
        recommendedNextStep: "voice",
      });
      addAttempt({
        id: crypto.randomUUID(),
        module: "cv-screening",
        date: new Date().toISOString(),
        overallScore: res.overallScore,
        maxScore: 100,
        feedback: normalizedFeedback,
        jobRole: currentJobRole,
        jobDescription: currentJobDescription,
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not analyze CV. Please try again.");
    } finally {
      setAnalyzing(false);
      setUploadStep("idle");
    }
  };

  const improvement = getImprovement("cv-screening");

  return (
    <AppLayout>
      <div className="px-6 py-8 md:px-10 md:py-10 max-w-3xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="mb-8 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
          <h1 className="text-2xl font-bold">CV Screening</h1>
          <p className="mt-1.5 text-muted-foreground">
            Upload your CV and compare it against the job description so the later interviews can use real fit context.
          </p>
        </div>

        {!result ? (
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <div className="mb-6 space-y-4 rounded-lg border bg-card p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Target Role</label>
                <input
                  type="text"
                  value={currentJobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Senior Backend Engineer"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Job Description</label>
                <textarea
                  value={currentJobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Paste the job description here so CV screening can evaluate role fit and prepare later interview stages."
                />
              </div>
            </div>

            {/* Upload area */}
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors duration-200",
                file ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx"
                aria-label="Upload CV file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileText className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(0)} KB — ready to analyze
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drop your CV here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Supports PDF and DOCX files
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!file || analyzing}
              className={cn(
                "mt-6 w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3",
                "font-medium text-sm transition-all duration-200",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "active:scale-[0.98]"
              )}
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your CV…
                </>
              ) : (
                "Analyze CV"
              )}
            </button>

            {analyzing && (
              <div className="mt-4 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    {uploadStep === "requesting-url" && "Requesting secure upload URL..."}
                    {uploadStep === "uploading" && "Uploading CV directly to storage..."}
                    {uploadStep === "analyzing" && "Running AI analysis..."}
                  </span>
                  <span className="tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.max(uploadProgress, uploadStep === "analyzing" ? 100 : 8)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Score */}
            <div
              className="flex flex-col sm:flex-row items-center gap-6 rounded-lg border bg-card p-6 mb-6 opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards" }}
            >
              <ScoreRing score={result.overallScore} maxScore={100} size={110} strokeWidth={8} />
              <div className="text-center sm:text-left">
                <h2 className="font-semibold text-lg">CV Score</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.overallScore >= 75
                    ? "Your CV is strong. Fine-tune the details below."
                    : result.overallScore >= 50
                      ? "Decent foundation — the suggestions below will help a lot."
                      : "There's room for improvement. Focus on the top suggestions."}
                </p>
                {improvement && (
                  <div className="mt-2 text-xs space-y-0.5">
                    {improvement.improved.length > 0 && (
                      <p className="text-score-high">↑ Improved: {improvement.improved.join(", ")}</p>
                    )}
                    {improvement.needsWork.length > 0 && (
                      <p className="text-score-low">↓ Needs work: {improvement.needsWork.join(", ")}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <FeedbackPanel
              feedback={[
                ...result.feedback,
                ...(result.insights
                  ? [{
                      category: "Process Insight",
                      score: Math.max(0, Math.min(25, Math.round(result.overallScore / 4))),
                      maxScore: 25,
                      comment: `Strengths: ${result.insights.strengths.join("; ") || "N/A"} | Risks: ${result.insights.risks.join("; ") || "N/A"}`,
                      suggestions: result.insights.nextSteps,
                    }]
                  : []),
              ]}
            />

            <button
              onClick={() => { setFile(null); setResult(null); }}
              className="mt-6 w-full rounded-lg border px-6 py-3 text-sm font-medium hover:bg-secondary transition-colors active:scale-[0.98]"
            >
              Upload Another CV
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
