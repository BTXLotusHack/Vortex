import { query } from "./pool.js";

export async function initializeSchema() {
  await query("CREATE EXTENSION IF NOT EXISTS vector;");
  await query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_url TEXT,
      tech_stack TEXT[] NOT NULL DEFAULT '{}',
      cv_text TEXT,
      job_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      overall_score INTEGER NOT NULL,
      breakdown JSONB NOT NULL,
      rationale TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      embedding vector(1536) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);");
  await query("CREATE INDEX IF NOT EXISTS idx_scores_session_id ON scores(session_id);");
  await query("CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id ON rag_documents(user_id);");
}
