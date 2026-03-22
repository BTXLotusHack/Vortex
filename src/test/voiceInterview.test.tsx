import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { startSession } = vi.hoisted(() => ({
  startSession: vi.fn(),
}));

vi.mock("@elevenlabs/client", () => ({
  Conversation: {
    startSession,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  apiUrl: vi.fn((path: string) => path),
  evaluateVoiceTranscript: vi.fn(),
}));

import VoiceInterview from "@/pages/VoiceInterview";
import { evaluateVoiceTranscript } from "@/lib/api";
import { resetInterviewStore } from "@/test/storeTestUtils";
import { useInterviewStore } from "@/stores/interviewStore";

describe("VoiceInterview", () => {
  beforeEach(() => {
    resetInterviewStore();
    startSession.mockReset();
    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({}),
      },
    });
  });

  it("shows the locked state until CV fit context exists", () => {
    render(
      <MemoryRouter>
        <VoiceInterview />
      </MemoryRouter>,
    );

    expect(screen.getByText("Voice Interview Locked")).toBeInTheDocument();
    expect(
      screen.getByText(/cv has been analyzed against the job description/i),
    ).toBeInTheDocument();
  });

  it("marks the voice interview complete and advances the pipeline", async () => {
    resetInterviewStore({
      latestCVFileName: "resume.pdf",
      candidateProfile: {
        summary: "Candidate profile summary",
        strengths: ["Communication"],
        risks: ["Metrics"],
        likelySkills: ["React"],
        seniority: "Mid-level",
        jobFitScore: 80,
        jobFitVerdict: "strong-fit",
        jobFitSummary: "Good fit",
      },
      pipeline: {
        active: true,
        cvUploaded: true,
        voiceRequired: true,
        technicalRequired: true,
        recommendedNextStep: "voice",
      },
    });

    startSession.mockImplementation(async (handlers: {
      onMessage?: (payload: { role: "user" | "agent"; message: string }) => void;
      onConnect?: (payload: { conversationId: string }) => void;
    }) => {
      handlers.onConnect?.({ conversationId: "conv-1" });
      handlers.onMessage?.({ role: "user", message: "My answer transcript" });
      return {
        isOpen: () => false,
        endSession: vi.fn(),
        getInputVolume: () => 0,
        getOutputVolume: () => 0,
        setVolume: vi.fn(),
      };
    });

    vi.mocked(evaluateVoiceTranscript).mockResolvedValue({
      overallScore: 17,
      maxScore: 20,
      feedback: [
        {
          category: "Communication",
          score: 17,
          maxScore: 20,
          comment: "Strong delivery",
          suggestions: ["Add metrics"],
        },
      ],
      summary: {
        gainedPoints: ["Clear structure"],
        lostPoints: ["Missing metrics"],
      },
    });

    render(
      <MemoryRouter initialEntries={["/voice-interview?from=pipeline"]}>
        <VoiceInterview />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /start voice interview/i }));

    await waitFor(() => {
      expect(screen.getByText("My answer transcript")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /score and complete voice interview/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /voice interview scored and saved/i }),
      ).toBeInTheDocument();
    });

    expect(useInterviewStore.getState().pipeline.lastCompletedStep).toBe("voice");
    expect(useInterviewStore.getState().pipeline.recommendedNextStep).toBe(
      "technical",
    );
  });
});
