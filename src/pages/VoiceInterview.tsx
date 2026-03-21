import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { useInterviewStore, type FeedbackItem } from "@/stores/interviewStore";
import { useAuthStore } from "@/stores/authStore";
import { getInterviewQuestions, evaluateAnswer } from "@/lib/api";
import { ArrowLeft, Mic, MicOff, Loader2, Play, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Conversation } from "@elevenlabs/client";

type RealtimeStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

type Question = Awaited<ReturnType<typeof getInterviewQuestions>>[number];

const API_URL = import.meta.env.VITE_API_URL || "";

export default function VoiceInterview() {
  const [stage, setStage] = useState<"setup" | "interview" | "results">("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [answers, setAnswers] = useState<Array<{ question: Question; answer: string; evaluation: any }>>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("disconnected");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationRef = useRef<Conversation | null>(null);

  const { currentJobRole, setJobRole, addAttempt, getImprovement } = useInterviewStore();
  const getAuthHeaders = (): Record<string, string> => ({});

  const fetchConversationToken = async (): Promise<string | null> => {
    if (!API_URL) return null;

    const endpointCandidates = [
      "/api/voice/conversation-token",
      "/api/voice/token",
      "/api/voice/realtime-token",
    ];

    for (const endpoint of endpointCandidates) {
      try {
        const response = await fetch(`${API_URL}${endpoint}`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (!response.ok) continue;
        const data = await response.json().catch(() => null);
        if (data?.token && typeof data.token === "string") return data.token;

        const text = await response.text();
        if (text) return text;
      } catch {
        continue;
      }
    }

    return null;
  };

  const startRealtimeConversation = async () => {
    try {
      if (conversationRef.current) return;

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const conversationToken = await fetchConversationToken();
      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

      if (!conversationToken && !agentId) {
        throw new Error("Realtime token endpoint not ready and VITE_ELEVENLABS_AGENT_ID is missing.");
      }

      setRealtimeStatus("connecting");
      const conversation = await Conversation.startSession({
        connectionType: "webrtc",
        ...(conversationToken ? { conversationToken } : { agentId }),
        onStatusChange: ({ status }) => {
          setRealtimeStatus(status);
          if (status === "connected") setRecording(true);
          if (status === "disconnected") setRecording(false);
        },
        onMessage: ({ role, message }) => {
          if (role === "user" && message.trim()) {
            setUserAnswer((prev) => (prev ? `${prev} ${message}` : message));
          }
        },
        onError: (message) => {
          toast.error(message || "Realtime voice stream failed.");
        },
      });

      conversationRef.current = conversation;
      toast.success("Realtime voice streaming connected.");
    } catch (error) {
      console.error(error);
      setRealtimeStatus("disconnected");
      setRecording(false);
      toast.error("Could not start realtime voice. Falling back to standard recording.");
      setRealtimeEnabled(false);
    }
  };

  const stopRealtimeConversation = async () => {
    if (!conversationRef.current) return;
    try {
      await conversationRef.current.endSession();
    } catch {
      // Session may already be closed.
    }
    conversationRef.current = null;
    setRealtimeStatus("disconnected");
    setRecording(false);
  };

  // TTS: Read question aloud via ElevenLabs or Web Speech API
  const speakQuestion = useCallback(async (text: string) => {
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
        console.warn("ElevenLabs TTS unavailable, falling back to browser speech");
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
  }, [ttsEnabled, getAuthHeaders]);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

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
        toast.info("Voice recorded. Paste or type your answer if speech-to-text is unavailable.");
      };

      mediaRecorder.start();
      setRecording(true);

      // Also try Web Speech API for live transcription
      if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
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
      const qs = await getInterviewQuestions(currentJobRole, "voice");
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
    if (stage === "interview" && questions[currentQ]) {
      speakQuestion(questions[currentQ].question);
    }
    return () => {
      speechSynthesis?.cancel();
      audioRef.current?.pause();
      void stopRealtimeConversation();
    };
  }, [currentQ, stage, questions, speakQuestion]);

  const submitAnswer = async () => {
    if (!userAnswer.trim()) return;
    if (recording) await stopRecording();
    setEvaluating(true);
    const q = questions[currentQ];
    try {
      const evaluation = await evaluateAnswer(q.id, userAnswer, q.expectedPoints);
      const newAnswers = [...answers, { question: q, answer: userAnswer, evaluation }];
      setAnswers(newAnswers);
      setUserAnswer("");

      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        const totalScore = newAnswers.reduce((s, a) => s + a.evaluation.score, 0);
        const maxScore = newAnswers.reduce((s, a) => s + a.evaluation.maxScore, 0);
        const feedback: FeedbackItem[] = newAnswers.map((a) => ({
          category: a.question.category,
          score: a.evaluation.score,
          maxScore: a.evaluation.maxScore,
          comment: a.evaluation.feedback,
          suggestions: a.evaluation.missedPoints.map((p: string) => `Cover: ${p}`),
        }));
        addAttempt({
          id: crypto.randomUUID(),
          module: "voice-interview",
          date: new Date().toISOString(),
          overallScore: totalScore,
          maxScore,
          feedback,
          jobRole: currentJobRole,
        });
        setStage("results");
      }
    } finally {
      setEvaluating(false);
    }
  };

  const latestFeedback =
    stage === "results" && answers.length > 0
      ? answers.map((a) => ({
          category: a.question.category,
          score: a.evaluation.score,
          maxScore: a.evaluation.maxScore,
          comment: a.evaluation.feedback,
          suggestions: a.evaluation.missedPoints.map((p: string) => `Cover: ${p}`),
        }))
      : [];

  const totalScore = answers.reduce((s, a) => s + a.evaluation?.score || 0, 0);
  const totalMax = answers.reduce((s, a) => s + a.evaluation?.maxScore || 0, 0);
  const improvement = getImprovement("voice-interview");

  return (
    <AppLayout>
      <div className="px-6 py-8 md:px-10 md:py-10 max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        {stage === "setup" && (
          <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
            <h1 className="text-2xl font-bold mb-2">Voice Interview</h1>
            <p className="text-muted-foreground mb-8">
              Practice answering interview questions. Questions will be read aloud (with ElevenLabs or browser speech). Record your answer or type it.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Target Role</label>
                <input
                  type="text"
                  value={currentJobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Frontend Developer"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                <span className="text-sm font-medium">Read questions aloud</span>
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  aria-label="Toggle text-to-speech"
                  title="Toggle text-to-speech"
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    ttsEnabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                      ttsEnabled && "translate-x-5"
                    )}
                  />
                </button>
              </div>

              <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Realtime voice stream (ElevenLabs WebRTC)</span>
                  <button
                    onClick={() => setRealtimeEnabled((prev) => !prev)}
                    aria-label="Toggle ElevenLabs realtime streaming"
                    title="Toggle ElevenLabs realtime streaming"
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      realtimeEnabled ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                        realtimeEnabled && "translate-x-5"
                      )}
                    />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-medium capitalize">{realtimeStatus}</span>
                </p>
              </div>

              <button
                onClick={startInterview}
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3",
                  "bg-primary text-primary-foreground font-medium text-sm",
                  "hover:bg-primary/90 active:scale-[0.98] transition-all",
                  "disabled:opacity-40"
                )}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Preparing questions…</>
                ) : (
                  <><Play className="h-4 w-4" /> Start Interview</>
                )}
              </button>
            </div>
          </div>
        )}

        {stage === "interview" && questions[currentQ] && (
          <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
            {/* Progress */}
            <div className="flex items-center gap-2 mb-6">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                    i < currentQ ? "bg-primary" : i === currentQ ? "bg-primary/50" : "bg-muted"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {questions[currentQ].category} — Question {currentQ + 1}/{questions.length}
              </span>
              <button
                onClick={() => {
                  if (isSpeaking) {
                    speechSynthesis?.cancel();
                    audioRef.current?.pause();
                    setIsSpeaking(false);
                  } else {
                    speakQuestion(questions[currentQ].question);
                  }
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {isSpeaking ? "Stop" : "Listen"}
              </button>
            </div>

            <h2 className="text-xl font-semibold mb-6 leading-snug">
              {questions[currentQ].question}
            </h2>

            <div className="space-y-4">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer or click Record to speak…"
                rows={5}
                className="w-full rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => void toggleRecording()}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all active:scale-[0.97]",
                    recording
                      ? "bg-destructive text-destructive-foreground animate-pulse-soft"
                      : "border hover:bg-secondary"
                  )}
                >
                  {recording ? (
                    <><MicOff className="h-4 w-4" /> Stop Recording</>
                  ) : (
                    <><Mic className="h-4 w-4" /> {realtimeEnabled ? "Start Live Mic" : "Record"}</>
                  )}
                </button>

                <button
                  onClick={submitAnswer}
                  disabled={!userAnswer.trim() || evaluating}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-lg px-6 py-2.5",
                    "bg-primary text-primary-foreground font-medium text-sm",
                    "hover:bg-primary/90 active:scale-[0.98] transition-all",
                    "disabled:opacity-40"
                  )}
                >
                  {evaluating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating…</>
                  ) : currentQ < questions.length - 1 ? (
                    <><ChevronRight className="h-4 w-4" /> Next Question</>
                  ) : (
                    "Finish Interview"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === "results" && (
          <div>
            <div
              className="flex flex-col sm:flex-row items-center gap-6 rounded-lg border bg-card p-6 mb-6 opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards" }}
            >
              <ScoreRing score={totalScore} maxScore={totalMax} size={110} strokeWidth={8} />
              <div className="text-center sm:text-left">
                <h2 className="text-lg font-semibold">Voice Interview Score</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalScore / totalMax >= 0.75
                    ? "Excellent communication! Minor areas to polish."
                    : totalScore / totalMax >= 0.5
                      ? "Good responses — review the missed points below."
                      : "Focus on covering the key points in your answers."}
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

            <FeedbackPanel feedback={latestFeedback} />

            <button
              onClick={() => setStage("setup")}
              className="mt-6 w-full rounded-lg border px-6 py-3 text-sm font-medium hover:bg-secondary transition-colors active:scale-[0.98]"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
