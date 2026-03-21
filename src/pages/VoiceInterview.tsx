import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, type Mode, type Status } from "@elevenlabs/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInterviewStore } from "@/stores/interviewStore";
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
import { ScoreRing } from "@/components/ScoreRing";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { useInterviewStore, type FeedbackItem } from "@/stores/interviewStore";
import { apiFetch, getInterviewQuestions, evaluateAnswer } from "@/lib/api";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Loader2,
  Play,
  ChevronRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Conversation } from "@elevenlabs/client";

type RealtimeStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting";

type Question = Awaited<ReturnType<typeof getInterviewQuestions>>[number];

const API_URL = import.meta.env.VITE_API_URL || "";

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

  const conversationRef = useRef<Conversation | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { currentJobRole, setJobRole, addAttempt, getImprovement } =
    useInterviewStore();
  const getAuthHeaders = useCallback((): Record<string, string> => ({}), []);

  const fetchConversationToken = async (): Promise<string | null> => {
    if (!API_URL) return null;

    const candidates = [
      "/api/voice/conversation-token",
      "/api/voice/token",
      "/api/voice/realtime-token",
    ];

    for (const endpoint of candidates) {
      try {
        const response = await fetch(
          `${API_URL}${endpoint}?agentId=${encodeURIComponent(agentId)}`,
          {
            method: "GET",
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
      // Session may already be closed.
    }
    conversationRef.current = null;
    setRealtimeStatus("disconnected");
    setRecording(false);
  };

  // TTS: Read question aloud via ElevenLabs or Web Speech API
  const speakQuestion = useCallback(
    async (text: string) => {
      if (!ttsEnabled) return;

      // Try ElevenLabs via backend
      if (API_URL) {
        try {
          setIsSpeaking(true);
          const response = await fetch(`${API_URL}/api/voice/tts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ text }),
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
              setIsSpeaking(false);
              URL.revokeObjectURL(url);
            };
            await audio.play();
            return;
          }
        } catch (err) {
          console.warn(
            "ElevenLabs TTS unavailable, falling back to browser speech",
          );
        }
      }

      // Fallback: Web Speech API
      if ("speechSynthesis" in window) {
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.onend = () => setIsSpeaking(false);
        speechSynthesis.speak(utterance);
      }
    },
    [ttsEnabled, getAuthHeaders],
  );

  // Start recording via MediaRecorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Try server STT
        if (API_URL) {
          try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            const res = await fetch(`${API_URL}/api/voice/stt`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                setUserAnswer((prev) => (prev ? prev + " " : "") + data.text);
                return;
              }
            }
          } catch {
            console.warn("Server STT unavailable");
          }
        }

        // Fallback: Web Speech API (already handles via SpeechRecognition below)
        toast.info(
          "Voice recorded. Paste or type your answer if speech-to-text is unavailable.",
        );
      };

      mediaRecorder.start();
      setRecording(true);

      // Also try Web Speech API for live transcription
      if (
        "webkitSpeechRecognition" in window ||
        "SpeechRecognition" in window
      ) {
        const SpeechRecognition =
          (window as any).webkitSpeechRecognition ||
          (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            setUserAnswer((prev) => (prev ? prev + " " : "") + transcript);
          }
        };

        recognition.onerror = () => {};
        recognition.start();
        (mediaRecorderRef.current as any)._recognition = recognition;
      }
    } catch (err) {
      toast.error("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopRecording = async () => {
    if (conversationRef.current) {
      await stopRealtimeConversation();
      return;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      const recognition = (mediaRecorderRef.current as any)?._recognition;
      if (recognition) recognition.stop();
    }
    setRecording(false);
  };

  const toggleRecording = async () => {
    if (recording) {
      await stopRecording();
      return;
    }

    if (realtimeEnabled) {
      await startRealtimeConversation();
    } else {
      startRecording();
    }
  };

  const startInterview = async () => {
    setLoading(true);
    try {
      const qs = await getInterviewQuestions(
        currentJobRole,
        "voice",
        questionCount,
      );
      setQuestions(qs);
      setCurrentQ(0);
      setAnswers([]);
      setStage("interview");
    } finally {
      setLoading(false);
    }
  };

  // Read question when it changes
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
                    <h2 className="mt-1 text-xl font-semibold">Talking orb</h2>
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
                    Once the interview is done, mark it complete here and
                    continue to the technical round if needed.
                  </p>

                  <div className="mt-5 space-y-3">
                    <button
                      onClick={markInterviewComplete}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all",
                        markedComplete
                          ? "bg-score-high/10 text-score-high"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {markedComplete
                        ? "Voice interview marked complete"
                        : "Mark Voice Interview Complete"}
                    </button>

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
