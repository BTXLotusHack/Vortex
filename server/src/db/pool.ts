import { Pool, type QueryResultRow } from "pg";
import dotenv from "dotenv";

// Load env from both server/.env and repo-root .env without overriding existing vars.
dotenv.config();
dotenv.config({ path: "../.env" });

function resolveConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.NEON_DATABASE_URL
  );
}

function validateConnectionString(connectionString: string) {
  const value = connectionString.trim();

  if (!value) {
    throw new Error(
      "Missing database URL. Set DATABASE_URL (or SUPABASE_DB_URL / NEON_DATABASE_URL) in .env.",
    );
  }

  if (value.includes("USER:PASSWORD@HOST:PORT")) {
    throw new Error(
      "DATABASE_URL still uses placeholder values. Replace it with a real Postgres connection string.",
    );
  }

  const lower = value.toLowerCase();
  if (!lower.startsWith("postgres://") && !lower.startsWith("postgresql://")) {
    if (
      value.includes("supabase.co") ||
      value.includes("vercel.app") ||
      value.includes("localhost:")
    ) {
      throw new Error(
        "DATABASE_URL must be a Postgres URL (postgresql://...), not a frontend API/site URL.",
      );
    }

    throw new Error(
      "DATABASE_URL must start with postgres:// or postgresql://.",
    );
  }

  try {
    // Validate URL structure early to provide a clear startup error.
    new URL(value);
  } catch {
    throw new Error(
      "Invalid DATABASE_URL format. Use a valid Postgres URI, e.g. postgresql://user:pass@host:5432/dbname",
    );
  }

  return value;
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
  const rawConnectionString = resolveConnectionString();
  if (!rawConnectionString) {
    throw new Error(
      "Missing database URL. Set DATABASE_URL (or SUPABASE_DB_URL / NEON_DATABASE_URL) in .env.",
    );
  }

  const connectionString = validateConnectionString(rawConnectionString);

  if (!db) {
    db = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString),
      max: 10,
    });
  }

  return db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
) {
  return getDb().query<T>(sql, params);
}
