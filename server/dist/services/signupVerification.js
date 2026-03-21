import "../env.js";
import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { AuthConflictError, AuthValidationError, createOrActivateUserAccount, normalizeEmail, } from "./users.js";
import { sendSignupOtpEmail, sendSignupSuccessEmail } from "./mail.js";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const OTP_TTL_MINUTES = Number(process.env.SIGNUP_OTP_TTL_MINUTES || 10);
export class SignupOtpError extends Error {
}
export class SignupOtpExpiredError extends Error {
}
function generateOtp() {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
function hashOtp(otp) {
    return createHash("sha256").update(otp).digest("hex");
}
function getOtpExpirationTimestamp() {
    return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}
async function savePendingSignup(input) {
    await query(`
      INSERT INTO signup_verifications (email, name, password_hash, otp_hash, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        otp_hash = EXCLUDED.otp_hash,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
    `, [input.email, input.name, input.passwordHash, input.otpHash, getOtpExpirationTimestamp()]);
}
async function getPendingSignup(email) {
    const result = await query(`
      SELECT email, name, password_hash, otp_hash, expires_at
      FROM signup_verifications
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `, [email]);
    return result.rows[0] || null;
}
export async function startSignupVerification(input) {
    const existingUser = await query(`
      SELECT password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `, [input.email]);
    if (existingUser.rows[0]?.password_hash) {
        throw new AuthConflictError("Unable to create account.");
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const otp = generateOtp();
    await savePendingSignup({
        email: normalizeEmail(input.email),
        name: input.name,
        passwordHash,
        otpHash: hashOtp(otp),
    });
    await sendSignupOtpEmail({
        to: input.email,
        name: input.name,
        otp,
    });
    return {
        email: input.email,
        message: "OTP sent successfully.",
    };
}
export async function resendSignupVerificationOtp(email) {
    const pendingSignup = await getPendingSignup(email);
    if (!pendingSignup) {
        throw new AuthValidationError("Please submit the signup form again.");
    }
    const otp = generateOtp();
    await query(`
      UPDATE signup_verifications
      SET otp_hash = $1, expires_at = $2, created_at = NOW()
      WHERE LOWER(email) = LOWER($3);
    `, [hashOtp(otp), getOtpExpirationTimestamp(), email]);
    await sendSignupOtpEmail({
        to: pendingSignup.email,
        name: pendingSignup.name,
        otp,
    });
    return {
        email: pendingSignup.email,
        message: "OTP sent successfully.",
    };
}
export async function verifySignupOtp(input) {
    const pendingSignup = await getPendingSignup(input.email);
    if (!pendingSignup) {
        throw new SignupOtpError("Invalid or expired OTP.");
    }
    const expiresAt = new Date(pendingSignup.expires_at).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
        throw new SignupOtpExpiredError("OTP has expired.");
    }
    if (pendingSignup.otp_hash !== hashOtp(input.otp)) {
        throw new SignupOtpError("Invalid or expired OTP.");
    }
    const user = await createOrActivateUserAccount({
        email: pendingSignup.email,
        name: pendingSignup.name,
        passwordHash: pendingSignup.password_hash,
    });
    await query(`
      DELETE FROM signup_verifications
      WHERE LOWER(email) = LOWER($1);
    `, [pendingSignup.email]);
    try {
        await sendSignupSuccessEmail({
            to: user.email,
            name: user.name,
        });
    }
    catch (error) {
        console.warn("Signup success email failed:", error);
    }
    return user;
}
//# sourceMappingURL=signupVerification.js.map