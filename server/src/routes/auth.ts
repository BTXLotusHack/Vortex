import { Router } from "express";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../lib/auth.js";
import { optionalAuth } from "../middleware/auth.js";
import { MailConfigurationError } from "../services/mail.js";
import {
  SignupOtpError,
  SignupOtpExpiredError,
  resendSignupVerificationOtp,
  startSignupVerification,
  verifySignupOtp,
} from "../services/signupVerification.js";
import {
  AuthConflictError,
  AuthUnauthorizedError,
  AuthValidationError,
  authenticateUser,
  validateSignupEmailInput,
  validateSignupOtpInput,
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
    const pending = await startSignupVerification(input);
    return res.status(202).json(pending);
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof AuthConflictError) {
      return res.status(409).json({ error: "Unable to create account." });
    }

    if (error instanceof MailConfigurationError) {
      return res.status(503).json({ error: "Mail service is not configured." });
    }

    if (isMissingDatabaseConfig(error)) {
      return res.status(500).json({ error: "Authentication service is not configured." });
    }

    console.error("Signup failed:", error);
    return res.status(500).json({ error: "Unable to create account." });
  }
});

authRouter.post("/signup/verify", async (req, res) => {
  try {
    const input = validateSignupOtpInput(req.body || {});
    const user = await verifySignupOtp(input);
    const token = signAuthToken(user);

    setAuthCookie(res, token);
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof SignupOtpExpiredError || error instanceof SignupOtpError) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    if (error instanceof AuthConflictError) {
      return res.status(409).json({ error: "Unable to create account." });
    }

    if (error instanceof MailConfigurationError) {
      return res.status(503).json({ error: "Mail service is not configured." });
    }

    if (isMissingDatabaseConfig(error)) {
      return res.status(500).json({ error: "Authentication service is not configured." });
    }

    console.error("Signup verification failed:", error);
    return res.status(500).json({ error: "Unable to verify OTP." });
  }
});

authRouter.post("/signup/resend", async (req, res) => {
  try {
    const { email } = validateSignupEmailInput(req.body || {});
    const pending = await resendSignupVerificationOtp(email);
    return res.status(202).json(pending);
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof MailConfigurationError) {
      return res.status(503).json({ error: "Mail service is not configured." });
    }

    if (isMissingDatabaseConfig(error)) {
      return res.status(500).json({ error: "Authentication service is not configured." });
    }

    console.error("Resend signup OTP failed:", error);
    return res.status(500).json({ error: "Unable to resend OTP." });
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
