import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
export const interviewRouter = Router();
// Get interview questions
interviewRouter.get("/questions", optionalAuth, async (req, res) => {
    try {
        const role = req.query.role || "Frontend Developer";
        const type = req.query.type || "voice";
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            const { default: OpenAI } = await import("openai");
            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Generate 5 ${type} interview questions for a "${role}" position. Return JSON array:
[{
  "id": "<unique-id>",
  "question": "<question text>",
  "category": "<category>",
  "difficulty": "easy" | "medium" | "hard",
  "expectedPoints": ["<key point 1>", "<key point 2>", ...]
}]

For voice: behavioral, situational, cultural-fit questions.
For technical: coding, system design, fundamentals questions.
Return only valid JSON array.`,
                    },
                ],
                response_format: { type: "json_object" },
            });
            const parsed = JSON.parse(completion.choices[0].message.content || "{}");
            const questions = parsed.questions || parsed;
            return res.json(Array.isArray(questions) ? questions : []);
        }
        // Fallback: mock questions
        if (type === "voice") {
            return res.json([
                { id: "v1", question: "Tell me about yourself and why you're interested in this role.", category: "Introduction", difficulty: "easy", expectedPoints: ["Brief professional background", "Relevant skills", "Motivation for the role"] },
                { id: "v2", question: "Describe a challenging project you worked on. What was your role and what was the outcome?", category: "Experience", difficulty: "medium", expectedPoints: ["Clear problem statement", "Your specific contribution", "Measurable outcome", "Lessons learned"] },
                { id: "v3", question: "How do you handle disagreements with team members about technical decisions?", category: "Behavioral", difficulty: "medium", expectedPoints: ["Active listening", "Data-driven approach", "Compromise and collaboration", "Specific example"] },
                { id: "v4", question: "Where do you see yourself in three years?", category: "Career Goals", difficulty: "easy", expectedPoints: ["Growth trajectory", "Alignment with company", "Continuous learning"] },
                { id: "v5", question: "Do you have any questions for us?", category: "Engagement", difficulty: "easy", expectedPoints: ["Thoughtful questions about team/culture", "Interest in growth opportunities", "Genuine curiosity"] },
            ]);
        }
        return res.json([
            { id: "t1", question: "What is the difference between 'let', 'const', and 'var' in JavaScript?", category: "JavaScript Fundamentals", difficulty: "easy", expectedPoints: ["Block scoping vs function scoping", "Hoisting behavior", "Reassignment rules for const"] },
            { id: "t2", question: "Explain the concept of closures and give a practical example.", category: "JavaScript Fundamentals", difficulty: "medium", expectedPoints: ["Function retaining access to outer scope", "Lexical environment", "Practical use case"] },
            { id: "t3", question: "What are React hooks? Explain useState and useEffect with examples.", category: "React", difficulty: "medium", expectedPoints: ["State management without classes", "Side effect handling", "Dependency array behavior", "Cleanup functions"] },
            { id: "t4", question: "How would you optimize a React application that is rendering slowly?", category: "Performance", difficulty: "hard", expectedPoints: ["React.memo / useMemo / useCallback", "Code splitting and lazy loading", "Virtual scrolling", "Profiler usage"] },
            { id: "t5", question: "Design a REST API for a todo application. What endpoints would you create?", category: "System Design", difficulty: "medium", expectedPoints: ["CRUD operations mapping to HTTP methods", "Proper status codes", "Resource naming conventions", "Authentication considerations"] },
        ]);
    }
    catch (error) {
        console.error("Questions error:", error);
        res.status(500).json({ error: "Failed to generate questions" });
    }
});
// Evaluate an answer
interviewRouter.post("/evaluate", optionalAuth, async (req, res) => {
    try {
        const { questionId, answer, expectedPoints } = req.body;
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey && answer) {
            const { default: OpenAI } = await import("openai");
            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Evaluate this interview answer. Expected points: ${JSON.stringify(expectedPoints)}.
Return JSON:
{
  "score": <0-20>,
  "maxScore": 20,
  "feedback": "<constructive feedback>",
  "matchedPoints": ["<matched point>", ...],
  "missedPoints": ["<missed point>", ...]
}
Be fair but thorough. Return only valid JSON.`,
                    },
                    { role: "user", content: answer },
                ],
                response_format: { type: "json_object" },
            });
            const result = JSON.parse(completion.choices[0].message.content || "{}");
            return res.json(result);
        }
        // Fallback mock
        const matched = expectedPoints.slice(0, Math.ceil(expectedPoints.length * 0.6));
        const missed = expectedPoints.slice(Math.ceil(expectedPoints.length * 0.6));
        return res.json({
            score: Math.round((matched.length / expectedPoints.length) * 20),
            maxScore: 20,
            feedback: "Good answer with solid fundamentals. Try to include more specific examples.",
            matchedPoints: matched,
            missedPoints: missed,
        });
    }
    catch (error) {
        console.error("Evaluation error:", error);
        res.status(500).json({ error: "Failed to evaluate answer" });
    }
});
//# sourceMappingURL=interview.js.map