import "../env.js";
import type { AuthUser } from "../middleware/auth.js";
export declare class SignupOtpError extends Error {
}
export declare class SignupOtpExpiredError extends Error {
}
export declare function startSignupVerification(input: {
    name: string;
    email: string;
    password: string;
}): Promise<{
    email: string;
    message: string;
}>;
export declare function resendSignupVerificationOtp(email: string): Promise<{
    email: string;
    message: string;
}>;
export declare function verifySignupOtp(input: {
    email: string;
    otp: string;
}): Promise<AuthUser>;
//# sourceMappingURL=signupVerification.d.ts.map