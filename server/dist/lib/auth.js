import "../env.js";
import jwt from "jsonwebtoken";
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vortex_auth";
const DEFAULT_TOKEN_TTL = "7d";
const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_SAME_SITE_VALUES = new Set(["strict", "lax", "none"]);
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("Missing JWT_SECRET. Set it in the server environment before using auth.");
    }
    return secret;
}
function getCookieSameSite() {
    const sameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase() ||
        process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
    if (sameSite && COOKIE_SAME_SITE_VALUES.has(sameSite)) {
        return sameSite;
    }
    return "lax";
}
function shouldUseSecureCookies() {
    if (process.env.COOKIE_SECURE === "true") {
        return true;
    }
    if (process.env.COOKIE_SECURE === "false") {
        return false;
    }
    return getCookieSameSite() === "none" || process.env.NODE_ENV === "production";
}
function getTokenTtl() {
    return (process.env.JWT_EXPIRES_IN ||
        DEFAULT_TOKEN_TTL);
}
function getCookieMaxAge() {
    const parsed = Number(process.env.AUTH_COOKIE_MAX_AGE_MS);
    return Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_COOKIE_MAX_AGE_MS;
}
function getCookieDomain() {
    const domain = process.env.COOKIE_DOMAIN?.trim();
    return domain || undefined;
}
function parseCookies(cookieHeader) {
    if (!cookieHeader)
        return {};
    return cookieHeader.split(";").reduce((acc, part) => {
        const [rawName, ...rawValue] = part.trim().split("=");
        if (!rawName)
            return acc;
        acc[rawName] = decodeURIComponent(rawValue.join("=") || "");
        return acc;
    }, {});
}
export function getAuthCookieOptions() {
    return {
        httpOnly: true,
        secure: shouldUseSecureCookies(),
        sameSite: getCookieSameSite(),
        maxAge: getCookieMaxAge(),
        domain: getCookieDomain(),
        path: "/",
    };
}
export function signAuthToken(user) {
    const options = {
        expiresIn: getTokenTtl(),
        subject: user.id,
    };
    return jwt.sign({
        email: user.email,
        name: user.name,
        avatar: user.avatar,
    }, getJwtSecret(), options);
}
export function verifyAuthToken(token) {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded.sub || !decoded.email || !decoded.name) {
        throw new Error("Invalid auth token payload.");
    }
    return {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        avatar: decoded.avatar,
    };
}
export function readAuthTokenFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[AUTH_COOKIE_NAME] || null;
}
export function setAuthCookie(res, token) {
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}
export function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: shouldUseSecureCookies(),
        sameSite: getCookieSameSite(),
        domain: getCookieDomain(),
        path: "/",
    });
}
//# sourceMappingURL=auth.js.map