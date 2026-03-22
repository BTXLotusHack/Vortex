import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/FeedbackPanel", () => ({
  FeedbackPanel: ({ feedback }: { feedback: Array<{ category: string }> }) => (
    <div data-testid="feedback-panel">{feedback.map((item) => item.category).join(", ")}</div>
  ),
}));

vi.mock("@/components/ScoreRing", () => ({
  ScoreRing: ({ score }: { score: number }) => <div>Score {score}</div>,
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="Code editor"
      value={value || ""}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  getInterviewQuestions: vi.fn(),
  evaluateAnswer: vi.fn(),
}));

import TechnicalInterview from "@/pages/TechnicalInterview";
import { evaluateAnswer, getInterviewQuestions } from "@/lib/api";
import { resetInterviewStore } from "@/test/storeTestUtils";
import { useInterviewStore } from "@/stores/interviewStore";

describe("TechnicalInterview", () => {
  beforeEach(() => {
    resetInterviewStore();
  });

  it("shows the locked state until CV analysis is complete", () => {
    render(
      <MemoryRouter>
        <TechnicalInterview />
      </MemoryRouter>,
    );

    expect(screen.getByText("Technical Interview Locked")).toBeInTheDocument();
  });

  it("generates questions, evaluates answers, and stores a completed attempt", async () => {
    resetInterviewStore({
      currentJobRole: "Frontend Engineer",
      currentJobDescription: "Build resilient React applications.",
      candidateProfile: {
        summary: "Strong frontend profile",
        strengths: ["React"],
        risks: ["System design"],
        likelySkills: ["React", "TypeScript"],
        seniority: "Mid-level",
        jobFitScore: 78,
        jobFitVerdict: "partial-fit",
        jobFitSummary: "Good enough to proceed",
      },
      pipeline: {
        active: true,
        cvUploaded: true,
        voiceRequired: true,
        technicalRequired: true,
        recommendedNextStep: "technical",
      },
    });

    vi.mocked(getInterviewQuestions).mockResolvedValue([
      {
        id: "q1",
        question: "Explain closures in JavaScript.",
        category: "JavaScript Fundamentals",
        difficulty: "medium",
        expectedPoints: ["Lexical scope", "Outer variables"],
        requiresCoding: false,
      },
    ]);

    vi.mocked(evaluateAnswer).mockResolvedValue({
      score: 16,
      maxScore: 20,
      feedback: "Solid answer",
      matchedPoints: ["Lexical scope"],
      missedPoints: ["Outer variables"],
      reasoning: "Reasonable structure",
      processInsight: {
        strengths: ["Structure"],
        risks: ["Examples"],
        nextSteps: ["Add a concrete example"],
      },
    });

    render(
      <MemoryRouter initialEntries={["/technical-interview?from=pipeline"]}>
        <TechnicalInterview />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /start technical interview/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Explain closures in JavaScript."),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText(/explain your reasoning/i),
      {
        target: { value: "A closure preserves access to lexical scope." },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: /finish interview/i }));

    await waitFor(() => {
      expect(screen.getByText("Technical Score")).toBeInTheDocument();
    });

    const state = useInterviewStore.getState();
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].module).toBe("technical-interview");
    expect(state.pipeline.lastCompletedStep).toBe("technical");
    expect(screen.getByTestId("feedback-panel")).toHaveTextContent(
      "JavaScript Fundamentals (medium)",
    );
  });
});
