import { Pool, type QueryResultRow } from "pg";
import dotenv from "dotenv";

// Load env from both server/.env and repo-root .env without overriding existing vars.
dotenv.config();
dotenv.config({ path: "../.env" });

function resolveConnectionString() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DATABASE_URL;
}

function shouldUseSsl(connectionString: string) {
  if (process.env.DB_SSL === "false") {
    return false;
  }

  if (process.env.DB_SSL === "true") {
    return { rejectUnauthorized: false };
  }

  try {
    const host = new URL(connectionString).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false;
    }
  } catch {
    // Fall back to SSL enabled for remote DB providers.
  }

  return { rejectUnauthorized: false };
}

let db: Pool | null = null;

function getDb() {
  const connectionString = resolveConnectionString();

  if (!connectionString) {
    throw new Error(
      "Missing database URL. Set DATABASE_URL (or SUPABASE_DB_URL / NEON_DATABASE_URL) in .env.",
    );
  }

  if (!db) {
    db = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString),
      max: 10,
    });
  }

  return db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return getDb().query<T>(sql, params);
}
