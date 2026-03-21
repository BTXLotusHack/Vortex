import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ModuleType = "cv-screening" | "voice-interview" | "technical-interview";

export interface FeedbackItem {
  category: string;
  score: number;
  maxScore: number;
  comment: string;
  suggestions: string[];
}

export interface AttemptResult {
  id: string;
  module: ModuleType;
  date: string;
  overallScore: number;
  maxScore: number;
  feedback: FeedbackItem[];
  jobRole?: string;
  jobDescription?: string;
  duration?: number;
  pipelineSessionId?: string;
}

export interface CandidateProfile {
  summary: string;
  strengths: string[];
  risks: string[];
  likelySkills: string[];
  seniority: string;
  jobFitScore?: number;
  jobFitVerdict?: "strong-fit" | "partial-fit" | "weak-fit";
  jobFitSummary?: string;
}

export interface SavedCVAnalysis {
  overallScore: number;
  insights?: {
    strengths: string[];
    risks: string[];
    nextSteps: string[];
  };
  candidateProfile: CandidateProfile | null;
}

export interface InterviewPipelineState {
  active: boolean;
  cvUploaded: boolean;
  voiceRequired: boolean;
  technicalRequired: boolean;
  recommendedNextStep: "cv" | "voice" | "technical" | "complete";
  lastCompletedStep?: "cv" | "voice" | "technical";
  currentSessionId?: string;
}

export interface PipelineRun {
  id: string;
  date: string;
  jobRole?: string;
  jobDescription?: string;
  cvAttemptId: string;
  voiceAttemptId: string;
  technicalAttemptId: string;
  score: number;
  maxScore: number;
}

export interface InterviewState {
  activeUserId: string | null;
  scopedDataByUser: Record<string, InterviewStoreData>;
  attempts: AttemptResult[];
  pipelineRuns: PipelineRun[];
  currentJobRole: string;
  currentJobDescription: string;
  latestCVFileName: string;
  latestCVScore: number | null;
  latestCVAnalysis: SavedCVAnalysis | null;
  candidateProfile: CandidateProfile | null;
  pipeline: InterviewPipelineState;
  addAttempt: (attempt: AttemptResult) => void;
  setJobRole: (role: string) => void;
  setJobDescription: (description: string) => void;
  setCandidateProfile: (profile: CandidateProfile | null) => void;
  setLatestCVAnalysis: (analysis: SavedCVAnalysis | null) => void;
  updatePipeline: (updates: Partial<InterviewPipelineState>) => void;
  resetPipeline: () => void;
  syncToUser: (userId: string | null) => void;
  upsertPipelineRun: (sessionId: string) => PipelineRun | null;
  setLatestCVContext: (payload: { fileName: string; score: number }) => void;
  getModuleAttempts: (module: ModuleType) => AttemptResult[];
  getLatestAttempt: (module: ModuleType) => AttemptResult | undefined;
  getPipelineRun: (id: string) => PipelineRun | undefined;
  getPipelineAttempts: (id: string) => AttemptResult[];
  getTotalScore: () => { score: number; max: number };
  getImprovement: (module: ModuleType) => { improved: string[]; needsWork: string[] } | null;
}

export interface InterviewStoreData {
  attempts: AttemptResult[];
  pipelineRuns: PipelineRun[];
  currentJobRole: string;
  currentJobDescription: string;
  latestCVFileName: string;
  latestCVScore: number | null;
  latestCVAnalysis: SavedCVAnalysis | null;
  candidateProfile: CandidateProfile | null;
  pipeline: InterviewPipelineState;
}

function createInitialInterviewData(): InterviewStoreData {
  return {
    attempts: [],
    pipelineRuns: [],
    currentJobRole: "Frontend Developer",
    currentJobDescription: "",
    latestCVFileName: "",
    latestCVScore: null,
    latestCVAnalysis: null,
    candidateProfile: null,
    pipeline: {
      active: false,
      cvUploaded: false,
      voiceRequired: true,
      technicalRequired: true,
      recommendedNextStep: "cv",
    },
  };
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set, get) => ({
      activeUserId: null,
      scopedDataByUser: {},
      ...createInitialInterviewData(),

      addAttempt: (attempt) =>
        set((state) => ({ attempts: [attempt, ...state.attempts] })),

      setJobRole: (role) => set({ currentJobRole: role }),
      setJobDescription: (description) => set({ currentJobDescription: description }),
      setCandidateProfile: (profile) => set({ candidateProfile: profile }),
      setLatestCVAnalysis: (analysis) => set({ latestCVAnalysis: analysis }),
      updatePipeline: (updates) =>
        set((state) => ({ pipeline: { ...state.pipeline, ...updates } })),
      resetPipeline: () =>
        set({
          latestCVFileName: "",
          latestCVScore: null,
          latestCVAnalysis: null,
          candidateProfile: null,
          pipeline: {
            active: false,
            cvUploaded: false,
            voiceRequired: true,
            technicalRequired: true,
            recommendedNextStep: "cv",
            currentSessionId: undefined,
          },
        }),
      syncToUser: (userId) =>
        set((state) => {
          const currentData: InterviewStoreData = {
            attempts: state.attempts,
            pipelineRuns: state.pipelineRuns,
            currentJobRole: state.currentJobRole,
            currentJobDescription: state.currentJobDescription,
            latestCVFileName: state.latestCVFileName,
            latestCVScore: state.latestCVScore,
            latestCVAnalysis: state.latestCVAnalysis,
            candidateProfile: state.candidateProfile,
            pipeline: state.pipeline,
          };

          const nextScopedDataByUser = { ...state.scopedDataByUser };
          if (state.activeUserId) {
            nextScopedDataByUser[state.activeUserId] = currentData;
          }

          if (!userId) {
            return {
              activeUserId: null,
              scopedDataByUser: nextScopedDataByUser,
              ...createInitialInterviewData(),
            };
          }

          return {
            activeUserId: userId,
            scopedDataByUser: nextScopedDataByUser,
            ...(nextScopedDataByUser[userId] || createInitialInterviewData()),
          };
        }),
      upsertPipelineRun: (sessionId) => {
        const attempts = get().attempts.filter((attempt) => attempt.pipelineSessionId === sessionId);
        const findLatest = (module: ModuleType) => attempts.find((attempt) => attempt.module === module);
        const cvAttempt = findLatest("cv-screening");
        const voiceAttempt = findLatest("voice-interview");
        const technicalAttempt = findLatest("technical-interview");

        if (!cvAttempt || !voiceAttempt || !technicalAttempt) {
          return null;
        }

        const pipelineRun: PipelineRun = {
          id: sessionId,
          date: technicalAttempt.date,
          jobRole: technicalAttempt.jobRole || voiceAttempt.jobRole || cvAttempt.jobRole,
          jobDescription: technicalAttempt.jobDescription || voiceAttempt.jobDescription || cvAttempt.jobDescription,
          cvAttemptId: cvAttempt.id,
          voiceAttemptId: voiceAttempt.id,
          technicalAttemptId: technicalAttempt.id,
          score: cvAttempt.overallScore + voiceAttempt.overallScore + technicalAttempt.overallScore,
          maxScore: cvAttempt.maxScore + voiceAttempt.maxScore + technicalAttempt.maxScore,
        };

        set((state) => ({
          pipelineRuns: [
            pipelineRun,
            ...state.pipelineRuns.filter((run) => run.id !== sessionId),
          ],
        }));

        return pipelineRun;
      },
      setLatestCVContext: ({ fileName, score }) =>
        set({
          latestCVFileName: fileName,
          latestCVScore: score,
        }),

      getModuleAttempts: (module) =>
        get().attempts.filter((a) => a.module === module),

      getLatestAttempt: (module) =>
        get().attempts.find((a) => a.module === module),

      getPipelineRun: (id) =>
        get().pipelineRuns.find((run) => run.id === id),

      getPipelineAttempts: (id) => {
        const run = get().getPipelineRun(id);
        if (!run) return [];

        const attemptsById = new Map(get().attempts.map((attempt) => [attempt.id, attempt]));
        return [run.cvAttemptId, run.voiceAttemptId, run.technicalAttemptId]
          .map((attemptId) => attemptsById.get(attemptId))
          .filter((attempt): attempt is AttemptResult => Boolean(attempt));
      },

      getTotalScore: () => {
        const modules: ModuleType[] = [
          "cv-screening",
          "voice-interview",
          "technical-interview",
        ];
        let score = 0;
        let max = 0;
        for (const m of modules) {
          const latest = get().getLatestAttempt(m);
          if (latest) {
            score += latest.overallScore;
            max += latest.maxScore;
          }
        }
        return { score, max: max || 300 };
      },

      getImprovement: (module) => {
        const attempts = get().getModuleAttempts(module);
        if (attempts.length < 2) return null;
        const latest = attempts[0];
        const previous = attempts[1];
        const improved: string[] = [];
        const needsWork: string[] = [];
        for (const fb of latest.feedback) {
          const prevFb = previous.feedback.find(
            (p) => p.category === fb.category
          );
          if (prevFb) {
            const pctNow = fb.score / fb.maxScore;
            const pctPrev = prevFb.score / prevFb.maxScore;
            if (pctNow > pctPrev) improved.push(fb.category);
            else if (pctNow < pctPrev) needsWork.push(fb.category);
          }
        }
        return { improved, needsWork };
      },
    }),
    { name: "interview-prep-store" }
  )
);
