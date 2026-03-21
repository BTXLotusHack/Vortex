import { Request, Response, NextFunction } from "express";
import { readAuthTokenFromRequest, verifyAuthToken } from "../lib/auth.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }

    interface User extends AuthUser {}
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = verifyAuthToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readAuthTokenFromRequest(req);

  if (token) {
    try {
      req.user = verifyAuthToken(token);
    } catch {
      req.user = undefined;
    }
  }

  next();
}
