import { Router } from "express";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../lib/auth.js";
import { optionalAuth } from "../middleware/auth.js";
import {
  AuthConflictError,
  AuthUnauthorizedError,
  AuthValidationError,
  authenticateUser,
  createUserAccount,
  validateLoginInput,
  validateSignupInput,
} from "../services/users.js";

export const authRouter = Router();

export function configurePassport() {
  return;
}

function isMissingDatabaseConfig(error: unknown) {
  return error instanceof Error && error.message.includes("Missing database URL");
}

authRouter.post("/signup", async (req, res) => {
  try {
    const input = validateSignupInput(req.body || {});
    const user = await createUserAccount(input);
    const token = signAuthToken(user);

    setAuthCookie(res, token);
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof AuthConflictError) {
      return res.status(409).json({ error: "Unable to create account." });
    }

    if (isMissingDatabaseConfig(error)) {
      return res.status(500).json({ error: "Authentication service is not configured." });
    }

    console.error("Signup failed:", error);
    return res.status(500).json({ error: "Unable to create account." });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const input = validateLoginInput(req.body || {});
    const user = await authenticateUser(input);
    const token = signAuthToken(user);

    setAuthCookie(res, token);
    return res.json({ user });
  } catch (error) {
    if (error instanceof AuthUnauthorizedError) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (isMissingDatabaseConfig(error)) {
      return res.status(500).json({ error: "Authentication service is not configured." });
    }

    console.error("Login failed:", error);
    return res.status(500).json({ error: "Unable to sign in." });
  }
});

authRouter.get("/me", optionalAuth, (req, res) => {
  return res.json({ user: req.user || null });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});
