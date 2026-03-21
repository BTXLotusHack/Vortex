import { Router } from "express";
import multer from "multer";
import { optionalAuth } from "../middleware/auth.js";
import { ChatOpenAI } from "@langchain/openai";
export const cvRouter = Router();
function readContentAsText(content) {
    if (typeof content === "string")
        return content;
    if (!Array.isArray(content))
        return "";
    return content
        .map((item) => {
        if (typeof item === "string")
            return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
            return item.text;
        }
        return "";
    })
        .join("");
}
function parseJsonText(raw) {
    if (!raw.trim())
        return null;
    const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        return null;
    }
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
        const role = req.body?.jobRole || "General";
        const jobDescription = req.body?.jobDescription || "";
        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // If OpenAI is configured, use it for real analysis
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            const llm = new ChatOpenAI({
                apiKey,
                model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
                temperature: 0.7,
            });
            // Extract text from PDF
            let text = "";
            if (file.mimetype === "application/pdf") {
                const pdfParse = (await import("pdf-parse")).default;
                const parsed = await pdfParse(file.buffer);
                text = parsed.text;
            }
            else {
                text = file.buffer.toString("utf-8");
            }
            const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const response = await llm.invoke([
                {
                    role: "system",
                    content: "You are an expert CV reviewer and hiring coach. Return only JSON.",
                },
                {
                    role: "user",
                    content: `Analyze this CV for target role "${role}".
Randomization seed: ${nonce}

CV text:\n${text.slice(0, 7000)}

Return strict JSON:
{
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
- Vary wording across runs while staying factual.

Relevant job description:
${jobDescription.slice(0, 5000) || "Not provided"}`,
                },
            ]);
            const parsed = parseJsonText(readContentAsText(response.content));
            if (parsed?.feedback?.length) {
                return res.json({
                    overallScore: Math.min(100, Math.max(0, Math.round(Number(parsed.overallScore ?? 70)))),
                    feedback: parsed.feedback,
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
                        jobFitScore: Number(parsed.candidateProfile?.jobFitScore || 0),
                        jobFitVerdict: parsed.candidateProfile?.jobFitVerdict || "partial-fit",
                        jobFitSummary: parsed.candidateProfile?.jobFitSummary || "",
                    },
                });
            }
        }
        // Fallback: mock analysis
        return res.json({
            overallScore: 72,
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
                summary: "Candidate shows relevant baseline experience for the target role, with the strongest upside coming from clearer impact framing and sharper positioning.",
                strengths: ["Relevant domain exposure", "Structured background", "Transferable delivery skills"],
                risks: ["Weak quantification of outcomes", "Generic positioning against the target JD"],
                likelySkills: ["Frontend development", "Cross-functional delivery", "UI implementation", "Team collaboration"],
                seniority: "Mid-level",
                jobFitScore: 72,
                jobFitVerdict: "partial-fit",
                jobFitSummary: "The profile appears relevant to the role, but there are still some gaps between the CV evidence and the JD expectations, especially around quantified impact and direct alignment to requirements.",
            },
        });
    }
    catch (error) {
        console.error("CV analysis error:", error);
        res.status(500).json({ error: "Failed to analyze CV" });
    }
});
//# sourceMappingURL=cv.js.map