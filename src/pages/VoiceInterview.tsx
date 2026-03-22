import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, type Mode, type Status } from "@elevenlabs/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInterviewStore } from "@/stores/interviewStore";
import { apiUrl, evaluateVoiceTranscript } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Mic,
  MicOff,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DEFAULT_ELEVENLABS_AGENT_ID = "agent_5601km7vdgwqfkdtxdev14rsyet7";

type TranscriptMessage = {
  id: string;
  role: "user" | "agent";
  message: string;
};

export default function VoiceInterview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPipeline = searchParams.get("from") === "pipeline";

  const [status, setStatus] = useState<Status>("disconnected");
  const [mode, setMode] = useState<Mode>("listening");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [audioLevel, setAudioLevel] = useState(0.18);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [voiceResult, setVoiceResult] = useState<Awaited<
    ReturnType<typeof evaluateVoiceTranscript>
  > | null>(null);

  const conversationRef = useRef<Conversation | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const {
    currentJobRole,
    currentJobDescription,
    candidateProfile,
    latestCVFileName,
    pipeline,
    updatePipeline,
    addAttempt,
    upsertPipelineRun,
  } = useInterviewStore();

  const interviewsUnlocked =
    pipeline.cvUploaded && Boolean(candidateProfile?.jobFitSummary);
  const agentId =
    import.meta.env.VITE_ELEVENLABS_AGENT_ID ||
    import.meta.env.VITE_ELEVENLABS_WIDGET_AGENT_ID ||
    DEFAULT_ELEVENLABS_AGENT_ID;

  const dynamicVariables = useMemo(
    () => ({
      job_title: currentJobRole,
      job_description: currentJobDescription,
      cv_file_name: latestCVFileName || "candidate-cv",
      cv_summary: candidateProfile?.summary || "",
      cv_strengths: candidateProfile?.strengths?.join(", ") || "",
      cv_risks: candidateProfile?.risks?.join(", ") || "",
      likely_skills: candidateProfile?.likelySkills?.join(", ") || "",
      likely_seniority: candidateProfile?.seniority || "",
      jd_fit_score: candidateProfile?.jobFitScore?.toString() || "",
      jd_fit_verdict: candidateProfile?.jobFitVerdict || "",
      jd_fit_summary: candidateProfile?.jobFitSummary || "",
    }),
    [candidateProfile, currentJobDescription, currentJobRole, latestCVFileName],
  );

  const fetchConversationToken = async (): Promise<string | null> => {
    const candidates = [
      "/api/voice/conversation-token",
      "/api/voice/token",
      "/api/voice/realtime-token",
    ];

    for (const endpoint of candidates) {
      try {
        const response = await fetch(
          `${apiUrl(endpoint)}?agentId=${encodeURIComponent(agentId)}`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (!response.ok) continue;

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json().catch(() => null);
          if (typeof data?.token === "string") return data.token;
        }

        const text = await response.text();
        if (text) return text;
      } catch {
        continue;
      }
    }

    return null;
  };

  const stopVolumeLoop = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const startVolumeLoop = () => {
    stopVolumeLoop();

    const tick = async () => {
      const session = conversationRef.current;
      if (!session || !session.isOpen()) {
        setAudioLevel(0.18);
        animationFrameRef.current = null;
        return;
      }

      const inputLevel = session.getInputVolume?.() ?? 0;
      const outputLevel = session.getOutputVolume?.() ?? 0;
      const next = Math.max(
        0.18,
        Math.min(1, inputLevel * 0.9 + outputLevel * 0.9 + 0.18),
      );
      setAudioLevel((previous) => previous * 0.65 + next * 0.35);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const startConversation = async () => {
    try {
      if (conversationRef.current) return;

      setMarkedComplete(false);
      setVoiceResult(null);
      setMessages([]);
      setConversationId("");

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const conversationToken = await fetchConversationToken();
      const sharedHandlers = {
        dynamicVariables,
        onConnect: ({ conversationId: id }: { conversationId: string }) => {
          setConversationId(id);
          toast.success("Voice interview connected.");
        },
        onDisconnect: (details: { reason: string; message?: string }) => {
          setStatus("disconnected");
          stopVolumeLoop();
          setAudioLevel(0.18);
          if (details.reason === "error") {
            toast.error(details.message || "Voice interview disconnected.");
          }
        },
        onError: (message: string) => {
          toast.error(message || "Could not start the ElevenLabs interview.");
        },
        onStatusChange: ({ status: nextStatus }: { status: Status }) => {
          setStatus(nextStatus);
          if (nextStatus === "connected") {
            startVolumeLoop();
            conversationRef.current?.setVolume?.({ volume: 1 });
          }
          if (nextStatus === "disconnected") {
            stopVolumeLoop();
          }
        },
        onModeChange: ({ mode: nextMode }: { mode: Mode }) => {
          setMode(nextMode);
        },
        onMessage: ({
          role,
          message,
        }: {
          role: "user" | "agent";
          message: string;
        }) => {
          if (!message.trim()) return;
          setMessages((current) => [
            ...current,
            {
              id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role,
              message,
            },
          ]);
        },
      };

      let conversation: Conversation;
      try {
        conversation = await Conversation.startSession({
          connectionType: "webrtc",
          ...(conversationToken ? { conversationToken } : { agentId }),
          ...sharedHandlers,
        });
      } catch (primaryError) {
        console.warn(
          "WebRTC conversation start failed, retrying with websocket.",
          primaryError,
        );
        conversation = await Conversation.startSession({
          connectionType: "websocket",
          agentId,
          ...sharedHandlers,
        });
      }

      conversationRef.current = conversation;
    } catch (error) {
      console.error(error);
      toast.error(
        "Could not start the ElevenLabs interview. Check microphone permissions and agent configuration.",
      );
    }
  };

  const endConversation = async () => {
    stopVolumeLoop();
    try {
      await conversationRef.current?.endSession();
    } catch {
      // session may already be closed
    } finally {
      conversationRef.current = null;
      setStatus("disconnected");
      setMode("listening");
      setAudioLevel(0.18);
    }
  };

  const markInterviewComplete = () => {
    if (!messages.some((message) => message.role === "user")) {
      toast.error("Finish the interview dialogue first so it can be scored.");
      return;
    }

    if (markedComplete) return;

    setEvaluating(true);
    void (async () => {
      try {
        const result = await evaluateVoiceTranscript({
          transcript: messages.map((message) => ({
            role: message.role,
            message: message.message,
          })),
          jobRole: currentJobRole,
          jobDescription: currentJobDescription,
          candidateProfile,
        });

        setVoiceResult(result);
        addAttempt({
          id: crypto.randomUUID(),
          module: "voice-interview",
          date: new Date().toISOString(),
          overallScore: result.overallScore,
          maxScore: result.maxScore,
          feedback: result.feedback,
          jobRole: currentJobRole,
          jobDescription: currentJobDescription,
          pipelineSessionId: fromPipeline ? pipeline.currentSessionId : undefined,
        });
        updatePipeline({
          active: true,
          lastCompletedStep: "voice",
          recommendedNextStep: pipeline.technicalRequired
            ? "technical"
            : "complete",
        });
        setMarkedComplete(true);
        toast.success("Voice interview scored and saved.");
        if (fromPipeline && pipeline.currentSessionId) {
          const pipelineRun = upsertPipelineRun(pipeline.currentSessionId);
          if (pipelineRun) {
            navigate(`/pipeline-summary/${pipelineRun.id}`);
          }
        }
      } catch (error) {
        console.error(error);
        toast.error("Could not score the voice interview.");
      } finally {
        setEvaluating(false);
      }
    })();
  };

  useEffect(() => {
    return () => {
      stopVolumeLoop();
      void conversationRef.current?.endSession();
    };
  }, []);

  const orbScale = 1 + audioLevel * (mode === "speaking" ? 0.3 : 0.18);

  return (
    <AppLayout>
      <div className="max-w-6xl pb-5 pt-0 md:pb-5 md:pt-0">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        {!interviewsUnlocked ? (
          <div className="rounded-[2rem] border border-luxe bg-card p-8">
            <h1 className="text-2xl font-bold">Voice Interview Locked</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              This stage only unlocks after the candidate CV has been analyzed
              against the job description. That fit assessment is what Alex uses
              to interview the candidate properly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
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
        ) : (
          <>
            <div
              className="surface-hero noise-overlay relative mb-8 overflow-hidden rounded-[2.5rem] border border-luxe px-6 py-8 opacity-0 animate-fade-up md:px-10 md:py-10"
              style={{ animationFillMode: "forwards" }}
            >
              <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,hsl(164_45%_78%/0.18),transparent_48%)]" />
              <div className="relative max-w-3xl">
                <div className="mb-4 inline-flex items-center rounded-full border border-primary/10 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                  ElevenLabs Interviewer
                </div>
                <h1 className="max-w-2xl font-display text-4xl leading-[0.98] text-gradient md:text-5xl">
                  Alex interviews the candidate live with a full voice session.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
                  The agent receives the CV summary, the job description, and
                  the CV-to-JD fit analysis before the conversation starts. The
                  left side is the live interview surface and the right side is
                  the running dialogue transcript.
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="surface-glass rounded-[2rem] border border-luxe p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                      Live Interview
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">Meet Alex!</h2>
                  </div>
                  <div className="rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {status}
                  </div>
                </div>

                <div className="flex min-h-[640px] flex-col items-center justify-center rounded-[1.75rem] border border-luxe bg-[radial-gradient(circle_at_top,hsl(164_48%_88%/0.28),transparent_38%),linear-gradient(180deg,hsl(38_55%_97%),hsl(145_27%_95%))] p-8">
                  <div className="relative flex h-[320px] w-[320px] items-center justify-center">
                    <div
                      className={cn(
                        "absolute h-[290px] w-[290px] rounded-full bg-primary/10 blur-3xl transition-all duration-300",
                        status === "connected" ? "opacity-100" : "opacity-40",
                      )}
                      style={{ transform: `scale(${orbScale + 0.05})` }}
                    />
                    <div
                      className={cn(
                        "absolute rounded-full border border-primary/20 bg-white/40 transition-all duration-200",
                        status === "connected"
                          ? "h-[250px] w-[250px]"
                          : "h-[220px] w-[220px]",
                      )}
                      style={{ transform: `scale(${orbScale})` }}
                    />
                    <div
                      className={cn(
                        "relative flex h-[200px] w-[200px] items-center justify-center rounded-full text-primary shadow-[0_25px_80px_hsl(166_35%_22%/0.2)] transition-all duration-200",
                        mode === "speaking"
                          ? "bg-[radial-gradient(circle_at_30%_30%,hsl(164_75%_76%),hsl(166_42%_48%))]"
                          : "bg-[radial-gradient(circle_at_30%_30%,hsl(40_90%_90%),hsl(168_45%_64%))]",
                      )}
                      style={{ transform: `scale(${orbScale})` }}
                    >
                      <Mic className="h-12 w-12 text-white" />
                    </div>
                  </div>

                  <p className="mt-8 text-lg font-semibold">
                    {status === "connected"
                      ? mode === "speaking"
                        ? "Alex is speaking"
                        : "Alex is listening"
                      : "Ready to start the interview"}
                  </p>
                  <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
                    {candidateProfile?.jobFitSummary}
                  </p>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => void startConversation()}
                      disabled={
                        status === "connecting" || status === "connected"
                      }
                      className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {status === "connecting"
                        ? "Connecting..."
                        : "Start Voice Interview"}
                    </button>
                    <button
                      onClick={() => void endConversation()}
                      disabled={
                        status !== "connected" && status !== "disconnecting"
                      }
                      className="rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="inline-flex items-center gap-2">
                        <MicOff className="h-4 w-4" /> End Interview
                      </span>
                    </button>
                  </div>

                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/60 px-4 py-4">
                      <p className="text-sm font-medium">Target role</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {currentJobRole}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/60 px-4 py-4">
                      <p className="text-sm font-medium">JD fit</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {(candidateProfile?.jobFitScore ?? 0) > 0
                          ? `${candidateProfile?.jobFitScore}/100`
                          : "Estimated"}{" "}
                        {candidateProfile?.jobFitVerdict
                          ? `- ${candidateProfile.jobFitVerdict}`
                          : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/60 px-4 py-4">
                      <p className="text-sm font-medium">Conversation ID</p>
                      <p className="mt-2 break-all text-sm leading-6 text-muted-foreground">
                        {conversationId || "Not connected yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="surface-glass rounded-[2rem] border border-luxe p-6">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                    Dialogue
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Interview transcript
                  </h2>
                  <div className="mt-5 flex max-h-[520px] min-h-[520px] flex-col gap-3 overflow-y-auto rounded-[1.5rem] border border-luxe bg-card p-4">
                    {messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center text-sm leading-7 text-muted-foreground">
                        <Mic className="mb-3 h-6 w-6 text-primary" />
                        Start the session and the transcript will appear here as
                        Alex and the candidate speak.
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7",
                            message.role === "agent"
                              ? "self-start bg-primary/10 text-foreground"
                              : "self-end bg-secondary text-foreground",
                          )}
                        >
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            {message.role === "agent" ? "Alex" : "Candidate"}
                          </div>
                          {message.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="surface-glass rounded-[2rem] border border-luxe p-6">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                    Interview context
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl bg-card px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4 text-primary" /> CV summary
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {candidateProfile?.summary ||
                          "No CV summary available."}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-card px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" /> Signals
                        for follow-up
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Strengths:{" "}
                        {candidateProfile?.strengths?.join(", ") || "N/A"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Risks: {candidateProfile?.risks?.join(", ") || "N/A"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Likely skills:{" "}
                        {candidateProfile?.likelySkills?.join(", ") || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="surface-glass rounded-[2rem] border border-luxe p-6">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                    Next step
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Move the pipeline forward
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Once the interview is done, score the dialogue here and
                    continue to the technical round if needed.
                  </p>

                  <div className="mt-5 space-y-3">
                    <button
                      onClick={markInterviewComplete}
                      disabled={evaluating}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all",
                        markedComplete
                          ? "bg-score-high/10 text-score-high"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                        evaluating && "cursor-not-allowed opacity-70",
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {evaluating
                        ? "Scoring Voice Interview..."
                        : markedComplete
                          ? "Voice interview scored and saved"
                          : "Score and Complete Voice Interview"}
                    </button>

                    {voiceResult && (
                      <div className="rounded-2xl bg-card px-4 py-4">
                        <p className="text-sm font-semibold">Voice summary</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {voiceResult.overallScore}/{voiceResult.maxScore}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          Got points for:{" "}
                          {voiceResult.summary.gainedPoints.join(", ") || "N/A"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Lost points from:{" "}
                          {voiceResult.summary.lostPoints.join(", ") || "N/A"}
                        </p>
                      </div>
                    )}

                    {fromPipeline && pipeline.technicalRequired && (
                      <button
                        onClick={() =>
                          navigate("/technical-interview?from=pipeline")
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                      >
                        Continue to Technical Interview{" "}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}

                    {fromPipeline && (
                      <Link
                        to="/interview-pipeline"
                        className="flex w-full items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                      >
                        Back to Pipeline Overview
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
