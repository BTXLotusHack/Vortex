import { beforeEach, describe, expect, it } from "vitest";
import { useInterviewStore } from "@/stores/interviewStore";
import { resetInterviewStore } from "@/test/storeTestUtils";

describe("useInterviewStore", () => {
  beforeEach(() => {
    resetInterviewStore();
  });

  it("computes total score using the latest attempt from each module", () => {
    resetInterviewStore({
      attempts: [
        {
          id: "tech-new",
          module: "technical-interview",
          date: "2026-03-22T12:00:00.000Z",
          overallScore: 16,
          maxScore: 20,
          feedback: [],
        },
        {
          id: "tech-old",
          module: "technical-interview",
          date: "2026-03-20T12:00:00.000Z",
          overallScore: 10,
          maxScore: 20,
          feedback: [],
        },
        {
          id: "voice-new",
          module: "voice-interview",
          date: "2026-03-22T10:00:00.000Z",
          overallScore: 18,
          maxScore: 20,
          feedback: [],
        },
        {
          id: "cv-new",
          module: "cv-screening",
          date: "2026-03-22T09:00:00.000Z",
          overallScore: 80,
          maxScore: 100,
          feedback: [],
        },
      ],
    });

    expect(useInterviewStore.getState().getTotalScore()).toEqual({
      score: 114,
      max: 140,
    });
  });

  it("tracks improvement and regression across attempts for one module", () => {
    resetInterviewStore({
      attempts: [
        {
          id: "latest",
          module: "technical-interview",
          date: "2026-03-22T12:00:00.000Z",
          overallScore: 16,
          maxScore: 20,
          feedback: [
            {
              category: "JavaScript",
              score: 8,
              maxScore: 10,
              comment: "Improved",
              suggestions: [],
            },
            {
              category: "System Design",
              score: 5,
              maxScore: 10,
              comment: "Needs work",
              suggestions: [],
            },
          ],
        },
        {
          id: "previous",
          module: "technical-interview",
          date: "2026-03-21T12:00:00.000Z",
          overallScore: 12,
          maxScore: 20,
          feedback: [
            {
              category: "JavaScript",
              score: 5,
              maxScore: 10,
              comment: "Earlier",
              suggestions: [],
            },
            {
              category: "System Design",
              score: 7,
              maxScore: 10,
              comment: "Earlier",
              suggestions: [],
            },
          ],
        },
      ],
    });

    expect(
      useInterviewStore.getState().getImprovement("technical-interview"),
    ).toEqual({
      improved: ["JavaScript"],
      needsWork: ["System Design"],
    });
  });
});
