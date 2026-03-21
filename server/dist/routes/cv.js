import { Router } from "express";
import multer from "multer";
import { optionalAuth } from "../middleware/auth.js";
export const cvRouter = Router();
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
        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // If OpenAI is configured, use it for real analysis
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            const { default: OpenAI } = await import("openai");
            const openai = new OpenAI({ apiKey });
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
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert CV reviewer. Analyze the CV and return a JSON response with:
{
  "overallScore": <number 0-100>,
  "feedback": [
    {
      "category": "<category name>",
      "score": <number 0-25>,
      "maxScore": 25,
      "comment": "<detailed feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
    }
  ]
}

Categories: "Formatting & Structure", "Content & Impact", "Keywords & ATS", "Overall Impression".
Be specific and actionable. Return only valid JSON.`,
                    },
                    { role: "user", content: `Analyze this CV:\n\n${text.slice(0, 6000)}` },
                ],
                response_format: { type: "json_object" },
            });
            const result = JSON.parse(completion.choices[0].message.content || "{}");
            return res.json(result);
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
        });
    }
    catch (error) {
        console.error("CV analysis error:", error);
        res.status(500).json({ error: "Failed to analyze CV" });
    }
});
//# sourceMappingURL=cv.js.map