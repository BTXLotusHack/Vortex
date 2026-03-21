import "../env.js";
import type { AuthUser } from "../middleware/auth.js";
export declare class AuthValidationError extends Error {
}
export declare class AuthConflictError extends Error {
}
export declare class AuthUnauthorizedError extends Error {
}
export declare function normalizeEmail(email: string): string;
export declare function normalizeName(name: string): string;
export declare function validateSignupInput(input: {
    name?: unknown;
    email?: unknown;
    password?: unknown;
}): {
    name: string;
    email: string;
    password: string;
};
export declare function validateLoginInput(input: {
    email?: unknown;
    password?: unknown;
}): {
    email: string;
    password: string;
};
export declare function createUserAccount(input: {
    name: string;
    email: string;
    password: string;
}): Promise<AuthUser>;
export declare function authenticateUser(input: {
    email: string;
    password: string;
}): Promise<{
    id: string;
    email: string;
    name: string;
    avatar: string | undefined;
}>;
//# sourceMappingURL=users.d.ts.map