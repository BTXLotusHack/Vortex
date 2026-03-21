import "../env.js";
import type { AuthUser } from "../middleware/auth.js";
type DbUserRow = AuthUser & {
    password_hash: string | null;
};
export declare class AuthValidationError extends Error {
}
export declare class AuthConflictError extends Error {
}
export declare class AuthUnauthorizedError extends Error {
}
export declare function toPublicUser(user: DbUserRow | AuthUser): {
    id: string;
    email: string;
    name: string;
    avatar: string | undefined;
};
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
export declare function validateSignupOtpInput(input: {
    email?: unknown;
    otp?: unknown;
}): {
    email: string;
    otp: string;
};
export declare function validateSignupEmailInput(input: {
    email?: unknown;
}): {
    email: string;
};
export declare function validateLoginInput(input: {
    email?: unknown;
    password?: unknown;
}): {
    email: string;
    password: string;
};
export declare function findUserByEmail(email: string): Promise<DbUserRow>;
export declare function validateProfileUpdateInput(input: {
    name?: unknown;
    email?: unknown;
}): {
    name: string;
    email: string;
};
export declare function validateChangePasswordInput(input: {
    currentPassword?: unknown;
    newPassword?: unknown;
}): {
    currentPassword: string;
    newPassword: string;
};
export declare function validateDeleteAccountInput(input: {
    password?: unknown;
}): {
    password: string;
};
export declare function updateCurrentUserProfile(input: {
    userId: string;
    name: string;
    email: string;
}): Promise<AuthUser>;
export declare function deleteCurrentUserAccount(input: {
    userId: string;
    password: string;
}): Promise<void>;
export declare function createOrActivateUserAccount(input: {
    name: string;
    email: string;
    passwordHash: string;
}): Promise<AuthUser>;
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
export {};
//# sourceMappingURL=users.d.ts.map