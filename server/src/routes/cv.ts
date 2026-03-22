import { Router } from "express";
import multer from "multer";
import { optionalAuth } from "../middleware/auth.js";
import { ChatOpenAI } from "@langchain/openai";

export const cvRouter = Router();

function clampScore(value: unknown, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(Number(value || 0))));
}

function normalizeScore(value: unknown) {
  return clampScore(value, 0, 100);
}

function normalizeJobFitVerdict(score: number) {
  if (score >= 75) return "strong-fit" as const;
  if (score >= 45) return "partial-fit" as const;
  return "weak-fit" as const;
}

function computeOverallCvScore(input: {
  genericQualityScore: number;
  jobFitScore: number;
  hasMeaningfulJobDescription: boolean;
}) {
  if (!input.hasMeaningfulJobDescription) {
    return input.genericQualityScore;
  }

  return clampScore(
    input.genericQualityScore * 0.35 + input.jobFitScore * 0.65,
    0,
    100,
  );
}

function readContentAsText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
        return item.text;
      }
      return "";
    })
    .join("");
}

function parseJsonText<T>(raw: string): T | null {
  if (!raw.trim()) return null;
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function normalizeCvFeedback(
  feedback: Array<{
    category: string;
    score: number;
    maxScore: number;
    comment: string;
    suggestions: string[];
  }> | undefined,
) {
  const preferredOrder = [
    "Formatting & Structure",
    "Content & Impact",
    "Keywords & ATS",
    "Overall Impression",
  ];

  const safeFeedback = (feedback || [])
    .map((item) => ({
      category: item.category,
      score: Math.min(25, Math.max(0, Math.round(Number(item.score || 0)))),
      maxScore: 25,
      comment: item.comment || "",
      suggestions: Array.isArray(item.suggestions) ? item.suggestions.filter(Boolean).slice(0, 3) : [],
    }))
    .filter((item) => preferredOrder.includes(item.category));

  const uniqueByCategory = preferredOrder
    .map((category) => safeFeedback.find((item) => item.category === category))
    .filter((item): item is (typeof safeFeedback)[number] => Boolean(item));

  return uniqueByCategory;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    cb(null, allowed.includes(file.mimetype));
  },
});

cvRouter.post("/analyze", optionalAuth, upload.single("cv"), async (req, res) => {
  try {
    const file = req.file;
    const role = (req.body?.jobRole as string) || "General";
    const jobDescription = (req.body?.jobDescription as string) || "";
    const hasMeaningfulJobDescription = jobDescription.trim().length >= 80;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // If OpenAI is configured, use it for real analysis
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const llm = new ChatOpenAI({
        apiKey,
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0,
      });

      // Extract text from PDF
      let text = "";
      if (file.mimetype === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(file.buffer);
        text = parsed.text;
      } else {
        text = file.buffer.toString("utf-8");
      }

      const response = await llm.invoke([
        {
          role: "system",
          content: `You are an expert CV reviewer and hiring coach. Return only JSON.

You must score the CV on two explicitly separate axes:
1. genericQualityScore (35% weight): the CV's standalone quality independent of this specific JD.
2. jobFitScore (65% weight): how well the CV matches the specific JD.

Scoring definitions:
- genericQualityScore: structure, clarity, quantified impact, professionalism, evidence quality, readability, and general ATS hygiene. This score should still make sense even if the JD were removed.
- jobFitScore: alignment to the specific JD's core requirements, must-have skills, seniority, domain, tools, responsibilities, and evidence of directly relevant achievements.

Important:
- Do not let a polished but irrelevant CV score highly overall.
- If the JD is meaningful, jobFitScore must dominate the final recommendation.
- If the JD is broad or messy, infer the 5-8 core must-have requirements first, then judge fit against those must-haves.
- Missing several core JD requirements should materially reduce jobFitScore.
- Keep the scoring deterministic and strict.`,
        },
        {
          role: "user",
          content: `Analyze this CV for target role "${role}".
CV text:\n${text.slice(0, 7000)}

Return strict JSON:
{
  "genericQualityScore": number,
  "jobFitScore": number,
  "overallScore": number,
  "feedback": [
    {
      "category": "Formatting & Structure | Content & Impact | Keywords & ATS | Overall Impression",
      "score": number,
      "maxScore": 25,
      "comment": "string",
      "suggestions": ["string", "string", "string"]
    }
  ],
  "insights": {
    "strengths": ["string"],
    "risks": ["string"],
    "nextSteps": ["string"]
  },
  "candidateProfile": {
    "summary": "string",
    "strengths": ["string"],
    "risks": ["string"],
    "likelySkills": ["string"],
    "seniority": "string",
    "jobFitScore": number,
    "jobFitVerdict": "strong-fit | partial-fit | weak-fit",
    "jobFitSummary": "string"
  }
}

Rules:
- Use all 4 categories once each.
- Keep suggestions concrete and tailored to this role.
- Keep the scoring deterministic and stable for the same CV + role + job description.
- Each feedback category must be scored from 0 to 25.
- genericQualityScore must be 0-100 and must measure only generic CV quality.
- jobFitScore must be 0-100 and must measure only JD fit.
- If a meaningful JD is provided, overallScore should reflect this formula:
  overallScore = round(genericQualityScore * 0.35 + jobFitScore * 0.65)
- If no meaningful JD is provided, overallScore should stay close to genericQualityScore.
- Treat JD matching as the dominant decision axis whenever a meaningful JD is present.

Relevant job description:
${jobDescription.slice(0, 5000) || "Not provided"}`,
        },
      ]);

      const parsed = parseJsonText<{
        genericQualityScore?: number;
        jobFitScore?: number;
        overallScore?: number;
        feedback?: Array<{
          category: string;
          score: number;
          maxScore: number;
          comment: string;
          suggestions: string[];
        }>;
        insights?: {
          strengths?: string[];
          risks?: string[];
          nextSteps?: string[];
        };
        candidateProfile?: {
          summary?: string;
          strengths?: string[];
          risks?: string[];
          likelySkills?: string[];
          seniority?: string;
          jobFitScore?: number;
          jobFitVerdict?: "strong-fit" | "partial-fit" | "weak-fit";
          jobFitSummary?: string;
        };
      }>(readContentAsText(response.content));

      if (parsed) {
        const normalizedFeedback = normalizeCvFeedback(parsed.feedback);

        if (normalizedFeedback.length === 4) {
        const genericQualityScore = normalizeScore(parsed.genericQualityScore);
        const jobFitScore = normalizeScore(
          parsed.jobFitScore ?? parsed.candidateProfile?.jobFitScore,
        );
        const computedOverallScore = computeOverallCvScore({
          genericQualityScore,
          jobFitScore,
          hasMeaningfulJobDescription,
        });

        return res.json({
          genericQualityScore,
          jobFitScore,
          overallScore: computedOverallScore,
          scoreBreakdown: {
            genericQualityScore,
            jobFitScore,
            genericQualityWeight: hasMeaningfulJobDescription ? 35 : 100,
            jobFitWeight: hasMeaningfulJobDescription ? 65 : 0,
          },
          feedback: normalizedFeedback,
          insights: {
            strengths: parsed.insights?.strengths || [],
            risks: parsed.insights?.risks || [],
            nextSteps: parsed.insights?.nextSteps || [],
          },
          candidateProfile: {
            summary: parsed.candidateProfile?.summary || "",
            strengths: parsed.candidateProfile?.strengths || [],
            risks: parsed.candidateProfile?.risks || [],
            likelySkills: parsed.candidateProfile?.likelySkills || [],
            seniority: parsed.candidateProfile?.seniority || "Unknown",
            jobFitScore,
            jobFitVerdict: normalizeJobFitVerdict(jobFitScore),
            jobFitSummary: parsed.candidateProfile?.jobFitSummary || "",
          },
        });
      }
      }
    }

    // Fallback: mock analysis
    const genericQualityScore = 73;
    const jobFitScore = hasMeaningfulJobDescription ? 61 : 73;
    const overallScore = computeOverallCvScore({
      genericQualityScore,
      jobFitScore,
      hasMeaningfulJobDescription,
    });

    return res.json({
      genericQualityScore,
      jobFitScore,
      overallScore,
      scoreBreakdown: {
        genericQualityScore,
        jobFitScore,
        genericQualityWeight: hasMeaningfulJobDescription ? 35 : 100,
        jobFitWeight: hasMeaningfulJobDescription ? 65 : 0,
      },
      feedback: [
        {
          category: "Formatting & Structure",
          score: 18,
          maxScore: 25,
          comment: "Good overall layout, but section headings could be more distinct.",
          suggestions: [
            "Use bold section headers with clear dividers",
            "Align dates consistently to the right margin",
            "Ensure consistent font sizes throughout",
          ],
        },
        {
          category: "Content & Impact",
          score: 16,
          maxScore: 25,
          comment: "Experience descriptions are too task-focused. Lead with measurable achievements.",
          suggestions: [
            "Start bullets with action verbs (Led, Increased, Built)",
            "Add quantifiable metrics (%, $, time saved)",
            "Focus on outcomes, not just duties",
          ],
        },
        {
          category: "Keywords & ATS",
          score: 20,
          maxScore: 25,
          comment: "Good keyword coverage. Missing some emerging technologies.",
          suggestions: [
            "Add relevant technical skills in a dedicated section",
            "Mirror language from target job descriptions",
            "Include industry-standard certifications",
          ],
        },
        {
          category: "Overall Impression",
          score: 18,
          maxScore: 25,
          comment: "Professional but generic. Needs a stronger personal brand.",
          suggestions: [
            "Add a concise professional summary (2-3 lines)",
            "Tailor content to your target role",
            "Remove outdated or irrelevant experience",
          ],
        },
      ],
      insights: {
        strengths: ["Readable overall structure", "Relevant domain experience present"],
        risks: ["Achievements are not quantified", "Skill positioning is too generic"],
        nextSteps: [
          "Rewrite top 3 bullets with measurable outcomes",
          "Align keywords with your target job description",
          "Add a 2-line summary focused on your role target",
        ],
      },
      candidateProfile: {
        summary:
          "Candidate shows relevant baseline experience for the target role, with the strongest upside coming from clearer impact framing and sharper positioning.",
        strengths: ["Relevant domain exposure", "Structured background", "Transferable delivery skills"],
        risks: ["Weak quantification of outcomes", "Generic positioning against the target JD"],
        likelySkills: ["Frontend development", "Cross-functional delivery", "UI implementation", "Team collaboration"],
        seniority: "Mid-level",
        jobFitScore,
        jobFitVerdict: normalizeJobFitVerdict(jobFitScore),
        jobFitSummary:
          "The profile appears relevant to the role, but there are still some gaps between the CV evidence and the JD expectations, especially around quantified impact and direct alignment to requirements.",
      },
    });
  } catch (error) {
    console.error("CV analysis error:", error);
    res.status(500).json({ error: "Failed to analyze CV" });
  }
});
