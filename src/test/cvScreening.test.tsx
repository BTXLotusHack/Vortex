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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  analyzeCV: vi.fn(),
  analyzeUploadedCV: vi.fn(),
  fetchJobRequirements: vi.fn(),
  requestCVUploadUrl: vi.fn(),
  uploadCVToPresignedUrl: vi.fn(),
}));

import CVScreening from "@/pages/CVScreening";
import { analyzeCV, requestCVUploadUrl } from "@/lib/api";
import { toast } from "sonner";
import { resetInterviewStore } from "@/test/storeTestUtils";
import { useInterviewStore } from "@/stores/interviewStore";

describe("CVScreening", () => {
  beforeEach(() => {
    resetInterviewStore();
  });

  it("blocks CV analysis when the target role is missing", async () => {
    resetInterviewStore({
      currentJobRole: "",
      currentJobDescription: "Detailed job description",
    });

    render(
      <MemoryRouter>
        <CVScreening />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/upload cv file/i), {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /analyze cv/i }));

    expect(toast.error).toHaveBeenCalledWith("Add the target role before analyzing.");
    expect(requestCVUploadUrl).not.toHaveBeenCalled();
  });

  it("blocks CV analysis when the job description is missing", async () => {
    resetInterviewStore({
      currentJobRole: "Frontend Engineer",
      currentJobDescription: "",
    });

    render(
      <MemoryRouter>
        <CVScreening />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/upload cv file/i), {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /analyze cv/i }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/job description/i),
    );
    expect(requestCVUploadUrl).not.toHaveBeenCalled();
  });

  it("stores CV analysis output and unlocks the pipeline after success", async () => {
    resetInterviewStore({
      currentJobRole: "Frontend Engineer",
      currentJobDescription: "Build modern frontend applications.",
    });

    vi.mocked(requestCVUploadUrl).mockResolvedValue(null);
    vi.mocked(analyzeCV).mockResolvedValue({
      overallScore: 84,
      feedback: [
        {
          category: "Formatting & Structure",
          score: 21,
          maxScore: 25,
          comment: "Clear structure",
          suggestions: ["Keep it concise"],
        },
      ],
      insights: {
        strengths: ["Strong React background"],
        risks: ["Needs more metrics"],
        nextSteps: ["Quantify impact"],
      },
      candidateProfile: {
        summary: "Strong frontend candidate",
        strengths: ["React"],
        risks: ["Impact framing"],
        likelySkills: ["TypeScript", "React"],
        seniority: "Mid-level",
        jobFitScore: 84,
        jobFitVerdict: "strong-fit",
        jobFitSummary: "Good fit for the role",
      },
    });

    render(
      <MemoryRouter>
        <CVScreening />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/upload cv file/i), {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /analyze cv/i }));

    await waitFor(() => {
      expect(analyzeCV).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("CV Score")).toBeInTheDocument();
    });

    const state = useInterviewStore.getState();
    expect(state.pipeline.cvUploaded).toBe(true);
    expect(state.pipeline.recommendedNextStep).toBe("voice");
    expect(state.candidateProfile?.summary).toBe("Strong frontend candidate");
    expect(state.attempts).toHaveLength(1);
    expect(state.latestCVFileName).toBe("resume.pdf");
  });

  it("allows CV analysis when a live job URL is provided", async () => {
    resetInterviewStore({
      currentJobRole: "Frontend Engineer",
      currentJobDescription: "",
    });

    vi.mocked(requestCVUploadUrl).mockResolvedValue(null);
    vi.mocked(analyzeCV).mockResolvedValue({
      overallScore: 80,
      feedback: [
        {
          category: "Formatting & Structure",
          score: 20,
          maxScore: 25,
          comment: "Clear structure",
          suggestions: ["Keep it concise"],
        },
      ],
      candidateProfile: {
        summary: "Strong frontend candidate",
        strengths: ["React"],
        risks: ["Impact framing"],
        likelySkills: ["TypeScript", "React"],
        seniority: "Mid-level",
      },
      jobContext: {
        jobText: "Live job description",
        techStack: ["React", "TypeScript"],
        source: "manus",
        jobUrl: "https://www.linkedin.com/jobs/view/123",
      },
    });

    render(
      <MemoryRouter>
        <CVScreening />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/live job url/i), {
      target: { value: "https://www.linkedin.com/jobs/view/123" },
    });

    fireEvent.change(screen.getByLabelText(/upload cv file/i), {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /analyze cv/i }));

    await waitFor(() => {
      expect(analyzeCV).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          jobRole: "Frontend Engineer",
          jobUrl: "https://www.linkedin.com/jobs/view/123",
        }),
      );
    });
  });
});
