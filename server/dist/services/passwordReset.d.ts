import "../env.js";
import type { AuthUser } from "../middleware/auth.js";
export declare class PasswordResetOtpError extends Error {
}
export declare class PasswordResetOtpExpiredError extends Error {
}
export declare function validateForgotPasswordInput(input: {
    email?: unknown;
}): {
    email: string;
};
export declare function validateResetPasswordInput(input: {
    email?: unknown;
    otp?: unknown;
    password?: unknown;
}): {
    email: string;
    otp: string;
    password: string;
};
export declare function startPasswordReset(email: string): Promise<{
    email: string;
    message: string;
}>;
export declare function resetPasswordWithOtp(input: {
    email: string;
    otp: string;
    password: string;
}): Promise<AuthUser>;
export declare function changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
}): Promise<void>;
//# sourceMappingURL=passwordReset.d.ts.map