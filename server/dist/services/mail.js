import "../env.js";
import nodemailer from "nodemailer";
const APP_NAME = process.env.APP_NAME || "VORTEX";
const OTP_TTL_MINUTES = Number(process.env.SIGNUP_OTP_TTL_MINUTES || 10);
export class MailConfigurationError extends Error {
}
function getMailConfig() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.MAIL_FROM;
    if (!host || !port || !user || !pass || !from) {
        throw new MailConfigurationError("Mail service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.");
    }
    return { host, port, secure, user, pass, from };
}
function createTransport() {
    const config = getMailConfig();
    return {
        from: config.from,
        transporter: nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        }),
    };
}
export async function sendSignupOtpEmail(input) {
    const { transporter, from } = createTransport();
    await transporter.sendMail({
        from,
        to: input.to,
        subject: `${APP_NAME} verification code`,
        text: `Hello ${input.name}, your OTP code is ${input.otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16332e;">
        <h2 style="margin-bottom: 8px;">Verify your ${APP_NAME} account</h2>
        <p>Hello ${input.name},</p>
        <p>Use the OTP below to complete your registration:</p>
        <div style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #f4efe5; font-size: 28px; font-weight: 700; letter-spacing: 8px;">
          ${input.otp}
        </div>
        <p style="margin-top: 16px;">This code expires in ${OTP_TTL_MINUTES} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
    });
}
export async function sendSignupSuccessEmail(input) {
    const { transporter, from } = createTransport();
    await transporter.sendMail({
        from,
        to: input.to,
        subject: `${APP_NAME} account created successfully`,
        text: `Hello ${input.name}, your ${APP_NAME} account has been created successfully.`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16332e;">
        <h2 style="margin-bottom: 8px;">Welcome to ${APP_NAME}</h2>
        <p>Hello ${input.name},</p>
        <p>Your account has been created successfully.</p>
        <p>You can now sign in and continue your interview prep journey.</p>
      </div>
    `,
    });
}
//# sourceMappingURL=mail.js.map