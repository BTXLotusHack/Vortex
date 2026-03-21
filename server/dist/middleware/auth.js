import jwt from "jsonwebtoken";
export function requireAuth(req, res, next) {
    // Check session first
    if (req.isAuthenticated?.() && req.user) {
        return next();
    }
    // Check JWT Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt-secret");
            req.user = decoded;
            return next();
        }
        catch {
            return res.status(401).json({ error: "Invalid token" });
        }
    }
    return res.status(401).json({ error: "Authentication required" });
}
export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt-secret");
        }
        catch {
            // Ignore invalid tokens for optional auth
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map