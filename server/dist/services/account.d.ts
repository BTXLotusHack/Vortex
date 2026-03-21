export interface ProfileRecord {
    user_id: string;
    full_name: string | null;
    contact_email: string | null;
    created_at: string;
    updated_at: string;
}
export interface UpdateProfileInput {
    full_name?: string;
    contact_email?: string;
}
export interface PasswordChangeInput {
    new_password: string;
}
export interface ForgotPasswordInput {
    email: string;
}
export interface ResetPasswordInput {
    email: string;
    otp: string;
    new_password: string;
}
export declare class AccountValidationError extends Error {
    constructor(message: string);
}
export declare class AccountConflictError extends Error {
    constructor(message: string);
}
export declare class AccountOperationError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare function validateProfileUpdateInput(payload: Record<string, unknown>): UpdateProfileInput;
export declare function validatePasswordChangeInput(payload: Record<string, unknown>): {
    new_password: string;
};
export declare function validateForgotPasswordInput(payload: Record<string, unknown>): {
    email: string;
};
export declare function validateResetPasswordInput(payload: Record<string, unknown>): {
    email: string;
    otp: string;
    new_password: string;
};
export declare function upsertProfile(userId: string, input: UpdateProfileInput): Promise<ProfileRecord>;
export declare function changePasswordWithSupabaseSession(params: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    newPassword: string;
}): Promise<void>;
export declare function sendForgotPasswordOtp(input: ForgotPasswordInput): Promise<void>;
export declare function resetPasswordWithOtp(input: ResetPasswordInput): Promise<void>;
//# sourceMappingURL=account.d.ts.map