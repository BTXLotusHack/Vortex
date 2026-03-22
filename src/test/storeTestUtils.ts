import { useAuthStore } from "@/stores/authStore";
import { useInterviewStore, type CandidateProfile } from "@/stores/interviewStore";

type AuthResetOverrides = Partial<Pick<ReturnType<typeof useAuthStore.getState>, "user" | "isLoading" | "pendingSignup">>;

type InterviewResetOverrides = Partial<{
  attempts: ReturnType<typeof useInterviewStore.getState>["attempts"];
  currentJobRole: string;
  currentJobDescription: string;
  latestCVFileName: string;
  latestCVScore: number | null;
  latestCVAnalysis: ReturnType<typeof useInterviewStore.getState>["latestCVAnalysis"];
  candidateProfile: CandidateProfile | null;
  pipeline: ReturnType<typeof useInterviewStore.getState>["pipeline"];
}>;

export function resetAuthStore(overrides: AuthResetOverrides = {}) {
  useAuthStore.setState({
    user: null,
    isLoading: false,
    pendingSignup: null,
    ...overrides,
  });
}

export function resetInterviewStore(overrides: InterviewResetOverrides = {}) {
  useInterviewStore.setState({
    attempts: [],
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
    ...overrides,
  });
}
