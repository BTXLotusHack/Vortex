import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { query } from "../db/pool.js";

type EnsureUserInput = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
};

type SessionArtifacts = {
  userId: string;
  sessionId: string;
  cvText?: string;
  jobText?: string;
  techStack?: string[];
  jobUrl?: string;
};

type ScoreInput = {
  userId: string;
  sessionId: string;
  question: string;
  answer: string;
};

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

function sanitizeText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toPgVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

function toChunks(text: string, size = 1300, overlap = 200) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export async function ensureUser(user: EnsureUserInput) {
  await query(
    `
      INSERT INTO users (id, email, name, avatar)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar;
    `,
    [user.id, user.email, user.name, user.avatar || null]
  );
}

export async function createSession(userId: string, jobUrl?: string) {
  const inserted = await query<{ id: string }>(
    `INSERT INTO sessions (user_id, job_url) VALUES ($1, $2) RETURNING id;`,
    [userId, jobUrl || null]
  );
  return inserted.rows[0].id;
}

export async function upsertSessionArtifacts(input: SessionArtifacts) {
  await query(
    `
      UPDATE sessions
      SET
        cv_text = COALESCE($1, cv_text),
        job_text = COALESCE($2, job_text),
        tech_stack = COALESCE($3::text[], tech_stack),
        job_url = COALESCE($4, job_url)
      WHERE id = $5 AND user_id = $6;
    `,
    [
      input.cvText ? sanitizeText(input.cvText) : null,
      input.jobText ? sanitizeText(input.jobText) : null,
      input.techStack && input.techStack.length > 0 ? input.techStack : null,
      input.jobUrl || null,
      input.sessionId,
      input.userId,
    ]
  );
}

async function indexRagDocument(params: {
  userId: string;
  sessionId: string;
  sourceType: "cv" | "job";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const normalized = sanitizeText(params.content);
  if (!normalized) return;

  const chunks = toChunks(normalized);
  for (const chunk of chunks) {
    const vector = await embeddings.embedQuery(chunk);
    await query(
      `
        INSERT INTO rag_documents (user_id, session_id, source_type, content, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector);
      `,
      [
        params.userId,
        params.sessionId,
        params.sourceType,
        chunk,
        JSON.stringify(params.metadata || {}),
        toPgVectorLiteral(vector),
      ]
    );
  }
}

export async function indexSessionKnowledge(input: SessionArtifacts) {
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

async function retrieveContext(userId: string, sessionId: string, queryText: string, topK = 6) {
  const queryEmbedding = await embeddings.embedQuery(queryText);
  const result = await query<{ content: string; source_type: string; similarity: number }>(
    `
      SELECT content, source_type, 1 - (embedding <=> $1::vector) AS similarity
      FROM rag_documents
      WHERE user_id = $2 AND session_id = $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4;
    `,
    [toPgVectorLiteral(queryEmbedding), userId, sessionId, topK]
  );

  return result.rows;
}

function parseScoringResponse(content: string) {
  const normalized = content.trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Invalid JSON from scoring model.");
  }
  return JSON.parse(normalized.slice(start, end + 1));
}

export async function scoreInterviewWithRag(input: ScoreInput) {
  const contextRows = await retrieveContext(
    input.userId,
    input.sessionId,
    `${input.question}\n${input.answer}`
  );

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

  await query(
    `
      INSERT INTO scores (session_id, user_id, overall_score, breakdown, rationale)
      VALUES ($1, $2, $3, $4::jsonb, $5);
    `,
    [
      input.sessionId,
      input.userId,
      parsed.overallScore,
      JSON.stringify(parsed.breakdown || {}),
      String(parsed.rationale || ""),
    ]
  );

  return {
    overallScore: parsed.overallScore,
    breakdown: parsed.breakdown || {},
    rationale: parsed.rationale || "",
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    retrievedContextCount: contextRows.length,
  };
}
