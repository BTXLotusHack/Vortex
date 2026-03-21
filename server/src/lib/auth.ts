import "../env.js";
import type { Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { AuthUser } from "../middleware/auth.js";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vortex_auth";

const DEFAULT_TOKEN_TTL = "7d";
const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type SameSiteMode = "strict" | "lax" | "none";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "Missing JWT_SECRET. Set it in the server environment before using auth.",
    );
  }

  return secret;
}

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }

  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

function getTokenTtl() {
  return (process.env.JWT_EXPIRES_IN ||
    DEFAULT_TOKEN_TTL) as SignOptions["expiresIn"];
}

function getCookieMaxAge() {
  const parsed = Number(process.env.AUTH_COOKIE_MAX_AGE_MS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_COOKIE_MAX_AGE_MS;
}

function getSameSiteMode(): SameSiteMode {
  const raw = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();

  if (raw === "strict" || raw === "lax" || raw === "none") {
    return raw;
  }

  // CloudFront frontend -> App Runner API is cross-site, so production
  // needs SameSite=None for auth cookies to be sent on credentialed requests.
  return process.env.NODE_ENV === "production" ? "none" : "strict";
}

function parseCookies(cookieHeader?: string | null) {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return acc;

    acc[rawName] = decodeURIComponent(rawValue.join("=") || "");
    return acc;
  }, {});
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: getSameSiteMode(),
    maxAge: getCookieMaxAge(),
    path: "/",
  };
}

export function signAuthToken(user: AuthUser) {
  const options: SignOptions = {
    expiresIn: getTokenTtl(),
    subject: user.id,
  };

  return jwt.sign(
    {
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
    getJwtSecret(),
    options,
  );
}

export function verifyAuthToken(token: string) {
  const decoded = jwt.verify(token, getJwtSecret()) as {
    sub?: string;
    email?: string;
    name?: string;
    avatar?: string;
  };

  if (!decoded.sub || !decoded.email || !decoded.name) {
    throw new Error("Invalid auth token payload.");
  }

  return {
    id: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    avatar: decoded.avatar,
  } satisfies AuthUser;
}

export function readAuthTokenFromRequest(req: Request) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: getSameSiteMode(),
    path: "/",
  });
}
