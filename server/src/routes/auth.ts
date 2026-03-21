import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../middleware/auth.js";

export const authRouter = Router();

// In-memory user store — replace with a database in production
const users = new Map<string, AuthUser>();

export function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.warn("⚠ Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: "/api/auth/google/callback",
      },
      (_accessToken, _refreshToken, profile, done) => {
        const user: AuthUser = {
          id: profile.id,
          email: profile.emails?.[0]?.value || "",
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
        };
        users.set(user.id, user);
        done(null, user);
      }
    )
  );

  passport.serializeUser((user, done) => done(null, (user as AuthUser).id));
  passport.deserializeUser((id: string, done) => {
    const user = users.get(id);
    done(null, user || null);
  });
}

// Google OAuth routes
authRouter.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

authRouter.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=auth_failed" }),
  (req, res) => {
    // Generate JWT for the client
    const token = jwt.sign(
      req.user as AuthUser,
      process.env.JWT_SECRET || "dev-jwt-secret",
      { expiresIn: "7d" }
    );
    const clientUrl = process.env.CLIENT_URL || "http://localhost:8000";
    res.redirect(`${clientUrl}/auth/callback?token=${token}`);
  }
);

// Get current user
authRouter.get("/me", (req, res) => {
  if (req.isAuthenticated?.() && req.user) {
    return res.json({ user: req.user });
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const user = jwt.verify(
        authHeader.slice(7),
        process.env.JWT_SECRET || "dev-jwt-secret"
      ) as AuthUser;
      return res.json({ user });
    } catch {
      return res.status(401).json({ user: null });
    }
  }

  res.json({ user: null });
});

// Logout
authRouter.post("/logout", (req, res) => {
  req.logout?.(() => {});
  res.json({ success: true });
});
