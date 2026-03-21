import type { NextFunction, Request, Response } from "express";
import type { User as SupabaseUser } from "@supabase/supabase-js";
export declare class AuthHeaderError extends Error {
    constructor(message: string);
}
declare global {
    namespace Express {
        interface Request {
            supabaseUser?: SupabaseUser;
            supabaseAccessToken?: string;
            supabaseRefreshToken?: string;
        }
    }
}
export declare function readBearerTokenFromRequest(req: Request): string | null;
export declare function readRefreshTokenFromRequest(req: Request): string | null;
export declare function requireSupabaseAuth(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=supabaseAuth.d.ts.map