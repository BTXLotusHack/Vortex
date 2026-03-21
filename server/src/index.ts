import "./env.js";
import express from "express";
import cors from "cors";
import { authRouter, configurePassport } from "./routes/auth.js";
import { cvRouter } from "./routes/cv.js";
import { interviewRouter } from "./routes/interview.js";
import { voiceRouter } from "./routes/voice.js";
import { dataRouter } from "./routes/data.js";
import { query } from "./db/pool.js";
import { initializeSchema } from "./db/schema.js";

const app = express();
const PORT = process.env.PORT || 3000;
const hasDbConnectionString = Boolean(
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DATABASE_URL,
);

function getAllowedClientOrigins() {
  const configured = (process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return ["http://localhost:8000", "http://127.0.0.1:8000"];
}

const allowedClientOrigins = new Set(getAllowedClientOrigins());

function classifyDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("missing database url")) {
    return "missing_config";
  }

  if (normalized.includes("does not exist")) {
    return "schema_missing";
  }

  if (
    normalized.includes("connect") ||
    normalized.includes("timeout") ||
    normalized.includes("enotfound") ||
    normalized.includes("econn") ||
    normalized.includes("certificate") ||
    normalized.includes("ssl")
  ) {
    return "connection_failed";
  }

  return "query_failed";
}

function sanitizeDatabaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedClientOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
configurePassport();

// Routes
app.use("/api/auth", authRouter);
app.use("/api/cv", cvRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/data", dataRouter);

// Health check
app.get("/api/health", async (_req, res) => {
  const payload: {
    status: "ok" | "degraded";
    timestamp: string;
    checks: Record<string, unknown>;
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {
      app: "ok",
    },
  };

  try {
    await query("SELECT 1;");
    payload.checks.database = "ok";
  } catch (error) {
    payload.status = "degraded";
    payload.checks.database = classifyDatabaseError(error);
    payload.checks.databaseError = sanitizeDatabaseErrorMessage(error);
    res.status(503).json(payload);
    return;
  }

  try {
    const tableCheck = await query<{
      users: boolean;
      signup_verifications: boolean;
      password_reset_verifications: boolean;
    }>(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'
        ) AS users,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'signup_verifications'
        ) AS signup_verifications,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'password_reset_verifications'
        ) AS password_reset_verifications;
    `);

    const tables = tableCheck.rows[0];
    payload.checks.authTables = {
      users: Boolean(tables?.users),
      signup_verifications: Boolean(tables?.signup_verifications),
      password_reset_verifications: Boolean(tables?.password_reset_verifications),
    };
  } catch (error) {
    payload.status = "degraded";
    payload.checks.authTables = "query_failed";
    payload.checks.authTablesError = sanitizeDatabaseErrorMessage(error);
  }

  const statusCode = payload.status === "ok" ? 200 : 503;
  res.status(statusCode).json(payload);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

if (hasDbConnectionString) {
  initializeSchema()
    .then(() => {
      console.log("Database schema is ready.");
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Database schema init failed:", message);
    });
} else {
  console.warn(
    "Database schema init skipped: missing DATABASE_URL (or SUPABASE_DB_URL / NEON_DATABASE_URL).",
  );
}

export default app;
