import { readAuthTokenFromRequest, verifyAuthToken } from "../lib/auth.js";
export function requireAuth(req, res, next) {
    const token = readAuthTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        req.user = verifyAuthToken(token);
        return next();
    }
    catch {
        return res.status(401).json({ error: "Authentication required" });
    }
}
export function optionalAuth(req, _res, next) {
    const token = readAuthTokenFromRequest(req);
    if (token) {
        try {
            req.user = verifyAuthToken(token);
        }
        catch {
            req.user = undefined;
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map