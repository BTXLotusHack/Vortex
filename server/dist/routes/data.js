import { Router } from "express";
import multer from "multer";
import { optionalAuth } from "../middleware/auth.js";
import { initializeSchema } from "../db/schema.js";
import { extractCvText } from "../services/jigsaw.js";
import { scrapeLinkedinJob } from "../services/manus.js";
import { createSession, ensureUser, indexSessionKnowledge, scoreInterviewWithRag, upsertSessionArtifacts, } from "../services/rag.js";
export const dataRouter = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
function resolveUser(req) {
    if (req.user?.id) {
        return {
            id: req.user.id,
            email: req.user.email || `${req.user.id}@local.dev`,
            name: req.user.name || "Interview User",
            avatar: req.user.avatar,
        };
    }
    const bodyUser = req.body?.user;
    if (bodyUser?.id && bodyUser?.email && bodyUser?.name) {
        return {
            id: bodyUser.id,
            email: bodyUser.email,
            name: bodyUser.name,
            avatar: bodyUser.avatar,
        };
    }
    return null;
}
dataRouter.post("/bootstrap", optionalAuth, async (_req, res) => {
    try {
        await initializeSchema();
        res.json({ success: true });
    }
    catch (error) {
        console.error("Schema bootstrap failed:", error);
        res.status(500).json({ error: "Schema bootstrap failed" });
    }
});
dataRouter.post("/sessions", optionalAuth, async (req, res) => {
    try {
        const user = resolveUser(req);
        if (!user) {
            return res.status(400).json({ error: "User context is required" });
        }
        await ensureUser(user);
        const sessionId = await createSession(user.id, req.body?.jobUrl);
        res.json({ sessionId });
    }
    catch (error) {
        console.error("Create session failed:", error);
        res.status(500).json({ error: "Failed to create session" });
    }
});
dataRouter.post("/cv/extract", optionalAuth, upload.single("cv"), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "CV file is required" });
        }
        const text = await extractCvText({
            file: {
                buffer: file.buffer,
                mimeType: file.mimetype,
                fileName: file.originalname,
            },
        });
        if (!text) {
            return res.status(422).json({ error: "Could not extract text from CV" });
        }
        const user = resolveUser(req);
        const sessionId = req.body?.sessionId;
        if (user && sessionId) {
            await ensureUser(user);
            await upsertSessionArtifacts({ userId: user.id, sessionId, cvText: text });
            await indexSessionKnowledge({ userId: user.id, sessionId, cvText: text });
        }
        res.json({ text });
    }
    catch (error) {
        console.error("CV extraction failed:", error);
        res.status(500).json({ error: "Failed to extract CV text" });
    }
});
dataRouter.post("/linkedin-tech-stack", optionalAuth, async (req, res) => {
    try {
        const { jobUrl, sessionId } = req.body || {};
        if (!jobUrl || typeof jobUrl !== "string") {
            return res.status(400).json({ error: "jobUrl is required" });
        }
        const scraped = await scrapeLinkedinJob(jobUrl);
        const user = resolveUser(req);
        if (user && sessionId) {
            await ensureUser(user);
            await upsertSessionArtifacts({
                userId: user.id,
                sessionId,
                jobUrl,
                jobText: scraped.jobText,
                techStack: scraped.techStack,
            });
            await indexSessionKnowledge({
                userId: user.id,
                sessionId,
                jobText: scraped.jobText,
                techStack: scraped.techStack,
            });
        }
        res.json(scraped);
    }
    catch (error) {
        console.error("LinkedIn scrape failed:", error);
        res.status(500).json({ error: "Failed to scrape LinkedIn job" });
    }
});
dataRouter.post("/rag/index", optionalAuth, async (req, res) => {
    try {
        const user = resolveUser(req);
        const { sessionId, cvText, jobText, techStack, jobUrl } = req.body || {};
        if (!user) {
            return res.status(400).json({ error: "User context is required" });
        }
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }
        await ensureUser(user);
        await upsertSessionArtifacts({
            userId: user.id,
            sessionId,
            cvText,
            jobText,
            techStack,
            jobUrl,
        });
        await indexSessionKnowledge({
            userId: user.id,
            sessionId,
            cvText,
            jobText,
            techStack,
            jobUrl,
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error("RAG indexing failed:", error);
        res.status(500).json({ error: "Failed to index RAG documents" });
    }
});
dataRouter.post("/rag/score", optionalAuth, async (req, res) => {
    try {
        const user = resolveUser(req);
        const { sessionId, question, answer } = req.body || {};
        if (!user) {
            return res.status(400).json({ error: "User context is required" });
        }
        if (!sessionId || !question || !answer) {
            return res.status(400).json({ error: "sessionId, question, and answer are required" });
        }
        await ensureUser(user);
        const scored = await scoreInterviewWithRag({
            userId: user.id,
            sessionId,
            question,
            answer,
        });
        res.json(scored);
    }
    catch (error) {
        console.error("RAG scoring failed:", error);
        res.status(500).json({ error: "Failed to score with RAG" });
    }
});
//# sourceMappingURL=data.js.map