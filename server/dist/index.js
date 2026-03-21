import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
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
// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:8000",
    credentials: true,
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
}));
// Passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());
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
initializeSchema()
    .then(() => {
    console.log("Database schema is ready.");
})
    .catch((error) => {
    console.warn("Database schema init skipped/failed:", error);
});
export default app;
//# sourceMappingURL=index.js.map