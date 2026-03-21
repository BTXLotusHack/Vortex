import "../env.js";
import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  AuthUnauthorizedError,
  AuthValidationError,
  findUserByEmail,
  normalizeEmail,
  toPublicUser,
} from "./users.js";
import { sendPasswordChangedEmail, sendPasswordResetOtpEmail } from "./mail.js";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const OTP_TTL_MINUTES = Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 10);

type PendingPasswordResetRow = {
  email: string;
  otp_hash: string;
  expires_at: string;
};

export class PasswordResetOtpError extends Error {}

export class PasswordResetOtpExpiredError extends Error {}

function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

function getOtpExpirationTimestamp() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

async function savePendingPasswordReset(input: {
  email: string;
  otpHash: string;
}) {
  await query(
    `
      INSERT INTO password_reset_verifications (email, otp_hash, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        otp_hash = EXCLUDED.otp_hash,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
    `,
    [input.email, input.otpHash, getOtpExpirationTimestamp()],
  );
}

async function getPendingPasswordReset(email: string) {
  const result = await query<PendingPasswordResetRow>(
    `
      SELECT email, otp_hash, expires_at
      FROM password_reset_verifications
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] || null;
}

async function deletePendingPasswordReset(email: string) {
  await query(
    `
      DELETE FROM password_reset_verifications
      WHERE LOWER(email) = LOWER($1);
    `,
    [email],
  );
}

export function validateForgotPasswordInput(input: { email?: unknown }) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";

  if (!email) {
    throw new AuthValidationError("Please provide a valid email address.");
  }

  return { email };
}

export function validateResetPasswordInput(input: {
  email?: unknown;
  otp?: unknown;
  password?: unknown;
}) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const otp = typeof input.otp === "string" ? input.otp.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!email) {
    throw new AuthValidationError("Please provide a valid email address.");
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new AuthValidationError("Please provide a valid 6-digit OTP.");
  }

  if (password.length < 8 || password.length > 72) {
    throw new AuthValidationError("Password must be between 8 and 72 characters.");
  }

  return { email, otp, password };
}

export async function startPasswordReset(email: string) {
  const user = await findUserByEmail(email);

  if (!user?.password_hash) {
    return {
      email,
      message: "If an account exists for that email, a reset code has been sent.",
    };
  }

  const otp = generateOtp();

  await savePendingPasswordReset({
    email: normalizeEmail(email),
    otpHash: hashOtp(otp),
  });

  await sendPasswordResetOtpEmail({
    to: user.email,
    name: user.name,
    otp,
  });

  return {
    email: user.email,
    message: "If an account exists for that email, a reset code has been sent.",
  };
}

export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  password: string;
}) {
  const pending = await getPendingPasswordReset(input.email);

  if (!pending) {
    throw new PasswordResetOtpError("Invalid or expired OTP.");
  }

  const expiresAt = new Date(pending.expires_at).getTime();
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    throw new PasswordResetOtpExpiredError("OTP has expired.");
  }

  if (pending.otp_hash !== hashOtp(input.otp)) {
    throw new PasswordResetOtpError("Invalid or expired OTP.");
  }

  const user = await findUserByEmail(input.email);
  if (!user?.password_hash) {
    throw new PasswordResetOtpError("Invalid or expired OTP.");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const updated = await query<AuthUser>(
    `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      RETURNING id, email, name, avatar;
    `,
    [passwordHash, user.id],
  );

  await deletePendingPasswordReset(user.email);

  const publicUser = updated.rows[0] || toPublicUser(user);

  try {
    await sendPasswordChangedEmail({
      to: publicUser.email,
      name: publicUser.name,
    });
  } catch (error) {
    console.warn("Password changed confirmation email failed:", error);
  }

  return publicUser;
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  if (!input.currentPassword) {
    throw new AuthValidationError("Please provide your current password.");
  }

  if (input.newPassword.length < 8 || input.newPassword.length > 72) {
    throw new AuthValidationError("Password must be between 8 and 72 characters.");
  }

  const result = await query<{
    id: string;
    email: string;
    name: string;
    avatar?: string;
    password_hash: string | null;
  }>(
    `
      SELECT id, email, name, avatar, password_hash
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [input.userId],
  );

  const user = result.rows[0];
  if (!user?.password_hash) {
    throw new AuthUnauthorizedError("Current password is incorrect.");
  }

  const matches = await bcrypt.compare(input.currentPassword, user.password_hash);
  if (!matches) {
    throw new AuthUnauthorizedError("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await query(
    `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2;
    `,
    [passwordHash, user.id],
  );

  try {
    await sendPasswordChangedEmail({
      to: user.email,
      name: user.name,
    });
  } catch (error) {
    console.warn("Password changed confirmation email failed:", error);
  }
}
