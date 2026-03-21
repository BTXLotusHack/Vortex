import "../env.js";
import type { Request, Response } from "express";
import type { AuthUser } from "../middleware/auth.js";
export declare const AUTH_COOKIE_NAME: string;
export declare function getAuthCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    maxAge: number;
    path: string;
};
export declare function signAuthToken(user: AuthUser): string;
export declare function verifyAuthToken(token: string): {
    id: string;
    email: string;
    name: string;
    avatar: string | undefined;
};
export declare function readAuthTokenFromRequest(req: Request): string | null;
export declare function setAuthCookie(res: Response, token: string): void;
export declare function clearAuthCookie(res: Response): void;
//# sourceMappingURL=auth.d.ts.map