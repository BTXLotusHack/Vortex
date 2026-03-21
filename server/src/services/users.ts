import "../env.js";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import type { AuthUser } from "../middleware/auth.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

type DbUserRow = AuthUser & {
  password_hash: string | null;
};

export class AuthValidationError extends Error {}

export class AuthConflictError extends Error {}

export class AuthUnauthorizedError extends Error {}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}

export function toPublicUser(user: DbUserRow | AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  } satisfies AuthUser;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function validateSignupInput(input: { name?: unknown; email?: unknown; password?: unknown }) {
  const name = typeof input.name === "string" ? normalizeName(input.name) : "";
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < 2 || name.length > 80) {
    throw new AuthValidationError("Please provide a valid name.");
  }

  if (!EMAIL_REGEX.test(email) || email.length > 320) {
    throw new AuthValidationError("Please provide a valid email address.");
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new AuthValidationError("Password must be between 8 and 72 characters.");
  }

  return { name, email, password };
}

export function validateSignupOtpInput(input: { email?: unknown; otp?: unknown }) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const otp = typeof input.otp === "string" ? input.otp.trim() : "";

  if (!EMAIL_REGEX.test(email)) {
    throw new AuthValidationError("Please provide a valid email address.");
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new AuthValidationError("Please provide a valid 6-digit OTP.");
  }

  return { email, otp };
}

export function validateSignupEmailInput(input: { email?: unknown }) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";

  if (!EMAIL_REGEX.test(email)) {
    throw new AuthValidationError("Please provide a valid email address.");
  }

  return { email };
}

export function validateLoginInput(input: { email?: unknown; password?: unknown }) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!EMAIL_REGEX.test(email) || !password) {
    throw new AuthUnauthorizedError("Invalid email or password.");
  }

  return { email, password };
}

export async function findUserByEmail(email: string) {
  const existing = await query<DbUserRow>(
    `
      SELECT id, email, name, avatar, password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return existing.rows[0] || null;
}

export function validateProfileUpdateInput(input: { name?: unknown; email?: unknown }) {
  const name = typeof input.name === "string" ? normalizeName(input.name) : "";
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";

  if (name.length < 2 || name.length > 80) {
    throw new AuthValidationError("Please provide a valid name.");
  }

  if (!EMAIL_REGEX.test(email) || email.length > 320) {
    throw new AuthValidationError("Please provide a valid email address.");
  }

  return { name, email };
}

export function validateChangePasswordInput(input: {
  currentPassword?: unknown;
  newPassword?: unknown;
}) {
  const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";

  if (!currentPassword) {
    throw new AuthValidationError("Please provide your current password.");
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new AuthValidationError("Password must be between 8 and 72 characters.");
  }

  return { currentPassword, newPassword };
}

export function validateDeleteAccountInput(input: { password?: unknown }) {
  const password = typeof input.password === "string" ? input.password : "";

  if (!password) {
    throw new AuthValidationError("Please provide your password to delete the account.");
  }

  return { password };
}

export async function updateCurrentUserProfile(input: {
  userId: string;
  name: string;
  email: string;
}) {
  try {
    const result = await query<AuthUser>(
      `
        UPDATE users
        SET name = $1, email = $2
        WHERE id = $3
        RETURNING id, email, name, avatar;
      `,
      [input.name, input.email, input.userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new AuthUnauthorizedError("Authentication required.");
    }

    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthConflictError("That email address is already in use.");
    }

    throw error;
  }
}

export async function deleteCurrentUserAccount(input: {
  userId: string;
  password: string;
}) {
  const result = await query<DbUserRow>(
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
    throw new AuthUnauthorizedError("Password is incorrect.");
  }

  const matches = await bcrypt.compare(input.password, user.password_hash);
  if (!matches) {
    throw new AuthUnauthorizedError("Password is incorrect.");
  }

  await query("DELETE FROM password_reset_verifications WHERE LOWER(email) = LOWER($1);", [user.email]);
  await query("DELETE FROM signup_verifications WHERE LOWER(email) = LOWER($1);", [user.email]);
  await query("DELETE FROM profiles WHERE user_id = $1::uuid;", [user.id]);
  await query("DELETE FROM users WHERE id = $1;", [user.id]);
}

export async function createOrActivateUserAccount(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser?.password_hash) {
    throw new AuthConflictError("Unable to create account.");
  }

  if (existingUser) {
    const updated = await query<AuthUser>(
      `
        UPDATE users
        SET name = $1, password_hash = $2
        WHERE id = $3
        RETURNING id, email, name, avatar;
      `,
      [input.name, input.passwordHash, existingUser.id],
    );

    return updated.rows[0];
  }

  try {
    const result = await query<AuthUser>(
      `
        INSERT INTO users (id, email, name, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, avatar;
      `,
      [randomUUID(), input.email, input.name, input.passwordHash],
    );

    return result.rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthConflictError("Unable to create account.");
    }

    throw error;
  }
}

export async function createUserAccount(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return createOrActivateUserAccount({
    name: input.name,
    email: input.email,
    passwordHash,
  });
}

export async function authenticateUser(input: { email: string; password: string }) {
  const result = await query<DbUserRow>(
    `
      SELECT id, email, name, avatar, password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [input.email],
  );

  const user = result.rows[0];
  if (!user?.password_hash) {
    throw new AuthUnauthorizedError("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatches) {
    throw new AuthUnauthorizedError("Invalid email or password.");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  } satisfies AuthUser;
}
