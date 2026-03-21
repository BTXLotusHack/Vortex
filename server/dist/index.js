import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter, configurePassport } from "./routes/auth.js";
import { cvRouter } from "./routes/cv.js";
import { interviewRouter } from "./routes/interview.js";
import { voiceRouter } from "./routes/voice.js";
import { dataRouter } from "./routes/data.js";
import { initializeSchema } from "./db/schema.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const hasDbConnectionString = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DATABASE_URL);
// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:8000",
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
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
}
else {
    console.warn("Database schema init skipped: missing DATABASE_URL (or SUPABASE_DB_URL / NEON_DATABASE_URL).");
}
export default app;
//# sourceMappingURL=index.js.map