import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  ScoreRing: ({ score, label }: { score: number; label?: string }) => (
    <div>
      {label || "Score"} {score}
    </div>
  ),
}));

import Results from "@/pages/Results";
import { resetInterviewStore } from "@/test/storeTestUtils";

describe("Results page", () => {
  beforeEach(() => {
    resetInterviewStore();
  });

  it("renders a safe empty state when there are no attempts", () => {
    render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no attempts yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it("filters attempt history and shows feedback for the selected attempt", () => {
    resetInterviewStore({
      attempts: [
        {
          id: "cv-1",
          module: "cv-screening",
          date: "2026-03-22T09:00:00.000Z",
          overallScore: 80,
          maxScore: 100,
          feedback: [
            {
              category: "Formatting",
              score: 20,
              maxScore: 25,
              comment: "Good",
              suggestions: [],
            },
          ],
          jobRole: "CV Role",
        },
        {
          id: "tech-1",
          module: "technical-interview",
          date: "2026-03-22T10:00:00.000Z",
          overallScore: 16,
          maxScore: 20,
          feedback: [
            {
              category: "JavaScript",
              score: 16,
              maxScore: 20,
              comment: "Solid",
              suggestions: [],
            },
          ],
          jobRole: "Tech Role",
        },
      ],
    });

    render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(screen.queryByText("CV Role")).not.toBeInTheDocument();
    expect(screen.getByText("Tech Role")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /technical/i })[1]);

    expect(screen.getByText(/feedback - technical/i)).toBeInTheDocument();
    expect(screen.getByTestId("feedback-panel")).toHaveTextContent("JavaScript");
  });
});
