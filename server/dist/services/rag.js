import { randomUUID } from "node:crypto";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { query } from "../db/pool.js";
const embeddings = new OpenAIEmbeddings({
    model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY,
});
const scorerModel = new ChatOpenAI({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
});
const scorePrompt = PromptTemplate.fromTemplate(`
You are an interview evaluator. Use ONLY the retrieved context to score the answer.

Context:
{context}

Question:
{question}

Candidate answer:
{answer}

Return strictly JSON with this shape:
{{
  "overallScore": <integer 0-100>,
  "breakdown": {{
    "roleFit": <integer 0-100>,
    "technicalDepth": <integer 0-100>,
    "communication": <integer 0-100>
  }},
  "rationale": "<concise explanation>",
  "improvements": ["<item>", "<item>"]
}}
`);
function sanitizeText(value) {
    return value
        .replace(/\u0000/g, "")
        .replace(/[\t ]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function toPgVectorLiteral(values) {
    return `[${values.join(",")}]`;
}
function toChunks(text, size = 1300, overlap = 200) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.slice(start, end));
        if (end >= text.length)
            break;
        start = Math.max(0, end - overlap);
    }
    return chunks;
}
export async function ensureUser(user) {
    await query(`
      INSERT INTO users (id, email, name, avatar)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar;
    `, [user.id, user.email, user.name, user.avatar || null]);
}
export async function createSession(userId, jobUrl) {
    const sessionId = randomUUID();
    const inserted = await query(`INSERT INTO sessions (id, user_id, job_url) VALUES ($1, $2, $3) RETURNING id;`, [sessionId, userId, jobUrl || null]);
    return inserted.rows[0].id;
}
export async function upsertSessionArtifacts(input) {
    await query(`
      UPDATE sessions
      SET
        cv_text = COALESCE($1, cv_text),
        job_text = COALESCE($2, job_text),
        tech_stack = COALESCE($3::text[], tech_stack),
        job_url = COALESCE($4, job_url)
      WHERE id = $5 AND user_id = $6;
    `, [
        input.cvText ? sanitizeText(input.cvText) : null,
        input.jobText ? sanitizeText(input.jobText) : null,
        input.techStack && input.techStack.length > 0 ? input.techStack : null,
        input.jobUrl || null,
        input.sessionId,
        input.userId,
    ]);
}
async function indexRagDocument(params) {
    const normalized = sanitizeText(params.content);
    if (!normalized)
        return;
    const chunks = toChunks(normalized);
    for (const chunk of chunks) {
        const vector = await embeddings.embedQuery(chunk);
        await query(`
        INSERT INTO rag_documents (id, user_id, session_id, source_type, content, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::vector);
      `, [
            randomUUID(),
            params.userId,
            params.sessionId,
            params.sourceType,
            chunk,
            JSON.stringify(params.metadata || {}),
            toPgVectorLiteral(vector),
        ]);
    }
}
export async function indexSessionKnowledge(input) {
    if (input.cvText) {
        await indexRagDocument({
            userId: input.userId,
            sessionId: input.sessionId,
            sourceType: "cv",
            content: input.cvText,
            metadata: { source: "cv" },
        });
    }
    if (input.jobText) {
        await indexRagDocument({
            userId: input.userId,
            sessionId: input.sessionId,
            sourceType: "job",
            content: input.jobText,
            metadata: { source: "job", techStack: input.techStack || [] },
        });
    }
}
async function retrieveContext(userId, sessionId, queryText, topK = 6) {
    const queryEmbedding = await embeddings.embedQuery(queryText);
    const result = await query(`
      SELECT content, source_type, 1 - (embedding <=> $1::vector) AS similarity
      FROM rag_documents
      WHERE user_id = $2 AND session_id = $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4;
    `, [toPgVectorLiteral(queryEmbedding), userId, sessionId, topK]);
    return result.rows;
}
function parseScoringResponse(content) {
    const normalized = content.trim();
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("Invalid JSON from scoring model.");
    }
    return JSON.parse(normalized.slice(start, end + 1));
}
export async function scoreInterviewWithRag(input) {
    const contextRows = await retrieveContext(input.userId, input.sessionId, `${input.question}\n${input.answer}`);
    const context = contextRows
        .map((row, index) => `#${index + 1} [${row.source_type}] (${row.similarity.toFixed(3)})\n${row.content}`)
        .join("\n\n")
        .slice(0, 10000);
    const prompt = await scorePrompt.format({
        context: context || "No context documents found.",
        question: input.question,
        answer: input.answer,
    });
    const completion = await scorerModel.invoke(prompt);
    const raw = typeof completion.content === "string" ? completion.content : JSON.stringify(completion.content);
    const parsed = parseScoringResponse(raw);
    await query(`
      INSERT INTO scores (id, session_id, user_id, overall_score, breakdown, rationale)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6);
    `, [
        randomUUID(),
        input.sessionId,
        input.userId,
        parsed.overallScore,
        JSON.stringify(parsed.breakdown || {}),
        String(parsed.rationale || ""),
    ]);
    return {
        overallScore: parsed.overallScore,
        breakdown: parsed.breakdown || {},
        rationale: parsed.rationale || "",
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        retrievedContextCount: contextRows.length,
    };
}
//# sourceMappingURL=rag.js.map