import "../env.js";
export declare class MailConfigurationError extends Error {
}
export declare function sendSignupOtpEmail(input: {
    to: string;
    name: string;
    otp: string;
}): Promise<void>;
export declare function sendSignupSuccessEmail(input: {
    to: string;
    name: string;
}): Promise<void>;
export declare function sendPasswordResetOtpEmail(input: {
    to: string;
    name: string;
    otp: string;
}): Promise<void>;
export declare function sendPasswordChangedEmail(input: {
    to: string;
    name: string;
}): Promise<void>;
//# sourceMappingURL=mail.d.ts.map