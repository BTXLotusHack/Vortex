import { Request, Response, NextFunction } from "express";
export interface AuthUser {
    id: string;
    email: string;
    name: string;
    avatar?: string;
}
declare global {
    namespace Express {
        interface User extends AuthUser {
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map