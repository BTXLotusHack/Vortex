import type { NextFunction, Request, Response } from "express";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  createSupabasePublicClient,
  SupabaseConfigurationError,
} from "../lib/supabase.js";

export class AuthHeaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthHeaderError";
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabaseUser?: SupabaseUser;
      supabaseAccessToken?: string;
      supabaseRefreshToken?: string;
    }
  }
}

export function readBearerTokenFromRequest(req: Request) {
  const authorization = req.header("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    throw new AuthHeaderError(
      "Authorization header must use the Bearer scheme.",
    );
  }

  return token;
}

export function readRefreshTokenFromRequest(req: Request) {
  const refreshToken =
    req.header("x-refresh-token") ||
    req.header("x-supabase-refresh-token") ||
    req.header("x-refresh");

  return refreshToken?.trim() || null;
}

export async function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let accessToken: string | null = null;

  try {
    accessToken = readBearerTokenFromRequest(req);
  } catch (error) {
    if (error instanceof AuthHeaderError) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(401).json({ error: "Authentication required." });
  }

  if (!accessToken) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return res
        .status(401)
        .json({ error: "Invalid or expired access token." });
    }

    req.supabaseAccessToken = accessToken;
    req.supabaseRefreshToken = readRefreshTokenFromRequest(req) ?? undefined;
    req.supabaseUser = data.user;
    return next();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return res
        .status(500)
        .json({ error: "Supabase authentication is not configured." });
    }

    console.error("Supabase auth middleware failed:", error);
    return res.status(500).json({ error: "Unable to authenticate request." });
  }
}
