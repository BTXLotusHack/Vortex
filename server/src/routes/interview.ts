import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { ChatOpenAI } from "@langchain/openai";

export const interviewRouter = Router();

type InterviewType = "voice" | "technical";

type InterviewQuestion = {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expectedPoints: string[];
  requiresCoding?: boolean;
};

type InsightPayload = {
  strengths: string[];
  risks: string[];
  nextSteps: string[];
};

function clampQuestionCount(input: unknown, fallback = 5) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function normalizeDifficulty(input: unknown): "easy" | "medium" | "hard" {
  if (input === "easy" || input === "hard") return input;
  return "medium";
}

function buildFallbackQuestions(type: InterviewType, count: number): InterviewQuestion[] {
  const voice: InterviewQuestion[] = [
    {
      id: randomId("v"),
      question: "Tell me about a time you had to explain a difficult technical topic to a non-technical stakeholder.",
      category: "Communication",
      difficulty: "medium",
      expectedPoints: ["Context", "How you simplified", "Outcome", "What you learned"],
      requiresCoding: false,
    },
    {
      id: randomId("v"),
      question: "Describe a production incident you handled and your communication flow with the team.",
      category: "Behavioral",
      difficulty: "hard",
      expectedPoints: ["Situation", "Your actions", "Collaboration", "Result"],
      requiresCoding: false,
    },
    {
      id: randomId("v"),
      question: "How do you prioritize when multiple urgent tasks arrive at once?",
      category: "Prioritization",
      difficulty: "medium",
      expectedPoints: ["Framework", "Trade-offs", "Stakeholder communication"],
      requiresCoding: false,
    },
  ];

  const technical: InterviewQuestion[] = [
    {
      id: randomId("t"),
      question: "Explain event loop behavior in JavaScript and how it affects async performance.",
      category: "Fundamentals",
      difficulty: "medium",
      expectedPoints: ["Call stack", "Task queues", "Microtask vs macrotask", "Practical impact"],
      requiresCoding: false,
    },
    {
      id: randomId("t"),
      question: "Implement a function to group an array of objects by a given key.",
      category: "Coding",
      difficulty: "easy",
      expectedPoints: ["Correct grouping", "Edge cases", "Readable code"],
      requiresCoding: true,
    },
    {
      id: randomId("t"),
      question: "Design an API cache invalidation strategy for frequently updated resources.",
      category: "System Design",
      difficulty: "hard",
      expectedPoints: ["TTL strategy", "Invalidation trigger", "Consistency trade-off", "Monitoring"],
      requiresCoding: false,
    },
  ];

  const source = type === "voice" ? voice : technical;
  const out: InterviewQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const picked = source[i % source.length];
    out.push({ ...picked, id: randomId(type === "voice" ? "v" : "t") });
  }
  return out;
}

async function generateQuestionsWithAI(
  role: string,
  type: InterviewType,
  count: number,
  questionBrief?: string,
): Promise<InterviewQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (type === "technical") {
      throw new Error("OPENAI_API_KEY is required for technical question generation");
    }
    return buildFallbackQuestions(type, count);
  }

  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  const llm = new ChatOpenAI({ apiKey, model, temperature: 0.9 });
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const prompt = `Create ${count} unique ${type} interview questions for role "${role}".
Randomization seed: ${nonce}
Custom candidate requirements: ${questionBrief || "None"}

Return STRICT JSON object with shape:
{
  "questions": [
    {
      "id": "string",
      "question": "string",
      "category": "string",
      "difficulty": "easy|medium|hard",
      "expectedPoints": ["string", "string", "string"],
      "requiresCoding": boolean
    }
  ]
}

Rules:
- Exactly ${count} questions.
- Voice interview: behavioral/communication/situational, requiresCoding must be false.
- Technical interview: mix of conceptual + coding; only coding questions set requiresCoding=true.
- expectedPoints must have 3-5 concrete criteria.
- Make this set different from typical templates.`;

  const response = await llm.invoke([
    {
      role: "system",
      content: "You are a senior interviewer creating varied, realistic interview questions. Return only JSON.",
    },
    { role: "user", content: prompt },
  ]);

  const parsed = parseJsonText<{ questions?: InterviewQuestion[] }>(readContentAsText(response.content));
  const questions = Array.isArray(parsed?.questions) ? parsed?.questions : [];

  if (!questions.length) {
    return buildFallbackQuestions(type, count);
  }

  return questions.slice(0, count).map((q, idx) => ({
    id: q.id || randomId(type === "voice" ? "v" : "t"),
    question: q.question,
    category: q.category || (type === "voice" ? "Behavioral" : "Technical"),
    difficulty: normalizeDifficulty(q.difficulty),
    expectedPoints: Array.isArray(q.expectedPoints) && q.expectedPoints.length
      ? q.expectedPoints.slice(0, 5)
      : ["Clear structure", "Technical correctness", "Practical relevance"],
    requiresCoding: type === "technical" ? Boolean(q.requiresCoding) : false,
  })).map((q, idx) => ({ ...q, id: q.id || `${type}-${idx + 1}` }));
}

async function evaluateWithAI(payload: {
  type: InterviewType;
  question: string;
  answer: string;
  expectedPoints: string[];
  difficulty?: string;
  requiresCoding?: boolean;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  const llm = new ChatOpenAI({ apiKey, model, temperature: 0.2 });

  const response = await llm.invoke([
    {
      role: "system",
      content: "You are an expert interviewer. Evaluate answers with objective scoring and actionable coaching. Return only JSON.",
    },
    {
      role: "user",
      content: `Evaluate this ${payload.type} answer.

Question: ${payload.question}
Difficulty: ${payload.difficulty || "medium"}
Requires coding: ${payload.requiresCoding ? "yes" : "no"}
Expected points: ${JSON.stringify(payload.expectedPoints)}
Candidate answer:\n${payload.answer}

Return strict JSON:
{
  "score": number,
  "maxScore": 20,
  "feedback": "string",
  "matchedPoints": ["string"],
  "missedPoints": ["string"],
  "reasoning": "string",
  "processInsight": {
    "strengths": ["string"],
    "risks": ["string"],
    "nextSteps": ["string"]
  }
}`,
    },
  ]);

  return parseJsonText<{
    score?: number;
    maxScore?: number;
    feedback?: string;
    matchedPoints?: string[];
    missedPoints?: string[];
    reasoning?: string;
    processInsight?: InsightPayload;
  }>(readContentAsText(response.content));
}

// Get interview questions
interviewRouter.get("/questions", optionalAuth, async (req, res) => {
  try {
    const role = (req.query.role as string) || "Frontend Developer";
    const rawType = (req.query.type as string) || "voice";
    const type: InterviewType = rawType === "technical" ? "technical" : "voice";
    const count = clampQuestionCount(req.query.count, 5);
    const questionBriefHeader = req.header("x-question-brief");
    const questionBriefQuery = req.query.brief as string | undefined;
    const questionBrief = (questionBriefHeader || questionBriefQuery || "").trim() || undefined;

    const questions = await generateQuestionsWithAI(role, type, count, questionBrief);
    res.set("Cache-Control", "no-store");
    return res.json(questions);
  } catch (error) {
    console.error("Questions error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate questions";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

// Evaluate an answer
interviewRouter.post("/evaluate", optionalAuth, async (req, res) => {
  try {
    const {
      answer,
      expectedPoints = [],
      type = "voice",
      question = "",
      difficulty,
      requiresCoding,
    } = req.body as {
      answer?: string;
      expectedPoints?: string[];
      type?: InterviewType;
      question?: string;
      difficulty?: string;
      requiresCoding?: boolean;
    };

    const safePoints = Array.isArray(expectedPoints) ? expectedPoints : [];
    if (!answer || !answer.trim()) {
      return res.status(400).json({ error: "Answer is required" });
    }

    const ai = await evaluateWithAI({
      type: type === "technical" ? "technical" : "voice",
      question,
      answer,
      expectedPoints: safePoints,
      difficulty,
      requiresCoding,
    });

    if (ai) {
      const maxScore = 20;
      const clampedScore = Math.min(maxScore, Math.max(0, Math.round(Number(ai.score || 0))));
      return res.json({
        score: clampedScore,
        maxScore,
        feedback: ai.feedback || "Good effort. Keep refining your structure and detail.",
        matchedPoints: Array.isArray(ai.matchedPoints) ? ai.matchedPoints : [],
        missedPoints: Array.isArray(ai.missedPoints) ? ai.missedPoints : [],
        reasoning: ai.reasoning || "Reasoning unavailable.",
        processInsight: {
          strengths: ai.processInsight?.strengths || [],
          risks: ai.processInsight?.risks || [],
          nextSteps: ai.processInsight?.nextSteps || [],
        },
      });
    }

    const matched = safePoints.slice(0, Math.ceil(safePoints.length * 0.6));
    const missed = safePoints.slice(Math.ceil(safePoints.length * 0.6));
    return res.json({
      score: safePoints.length ? Math.round((matched.length / safePoints.length) * 20) : 12,
      maxScore: 20,
      feedback: "Good answer with solid fundamentals. Try to include more specific examples.",
      matchedPoints: matched,
      missedPoints: missed,
      reasoning: "Fallback evaluation used because AI evaluator is unavailable.",
      processInsight: {
        strengths: matched.slice(0, 2),
        risks: missed.slice(0, 2),
        nextSteps: missed.slice(0, 2).map((item) => `Practice: ${item}`),
      },
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
});
