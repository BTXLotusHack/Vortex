import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check session first
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }

  // Check JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt-secret") as AuthUser;
      req.user = decoded;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  return res.status(401).json({ error: "Authentication required" });
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt-secret") as AuthUser;
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}
