import { query } from "../db/pool.js";
import { createSupabasePublicClient, createSupabaseSessionClient } from "../lib/supabase.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

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

export class AccountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountValidationError";
  }
}

export class AccountConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountConflictError";
  }
}

export class AccountOperationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AccountOperationError";
    this.status = status;
  }
}

function normalizeEmail(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new AccountValidationError(`${fieldName} is required.`);
  }

  const email = value.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new AccountValidationError(`${fieldName} must be a valid email address.`);
  }

  if (email.length > 255) {
    throw new AccountValidationError(`${fieldName} must be 255 characters or fewer.`);
  }

  return email;
}

function normalizeFullName(value: unknown) {
  if (typeof value !== "string") {
    throw new AccountValidationError("full_name must be a string.");
  }

  const fullName = value.trim().replace(/\s+/g, " ");
  if (!fullName) {
    throw new AccountValidationError("full_name cannot be empty.");
  }

  if (fullName.length > 120) {
    throw new AccountValidationError("full_name must be 120 characters or fewer.");
  }

  return fullName;
}

function normalizePassword(value: unknown) {
  if (typeof value !== "string") {
    throw new AccountValidationError("new_password is required.");
  }

  const password = value;
  if (password.length < 8) {
    throw new AccountValidationError("new_password must be at least 8 characters long.");
  }

  if (password.length > 128) {
    throw new AccountValidationError("new_password must be 128 characters or fewer.");
  }

  return password;
}

function normalizeOtp(value: unknown) {
  if (typeof value !== "string") {
    throw new AccountValidationError("otp is required.");
  }

  const otp = value.trim();
  if (!OTP_PATTERN.test(otp)) {
    throw new AccountValidationError("otp must be a 6-digit code.");
  }

  return otp;
}

function getSupabaseErrorStatus(error: unknown, fallback: number) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && Number.isFinite(status)) {
      return status;
    }
  }

  return fallback;
}

function getSupabaseErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

export function validateProfileUpdateInput(payload: Record<string, unknown>) {
  const input: UpdateProfileInput = {};

  if (Object.prototype.hasOwnProperty.call(payload, "full_name")) {
    input.full_name = normalizeFullName(payload.full_name);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "contact_email")) {
    input.contact_email = normalizeEmail(payload.contact_email, "contact_email");
  }

  if (!input.full_name && !input.contact_email) {
    throw new AccountValidationError(
      "Provide at least one of full_name or contact_email to update the profile.",
    );
  }

  return input;
}

export function validatePasswordChangeInput(payload: Record<string, unknown>) {
  return {
    new_password: normalizePassword(payload.new_password),
  } satisfies PasswordChangeInput;
}

export function validateForgotPasswordInput(payload: Record<string, unknown>) {
  return {
    email: normalizeEmail(payload.email, "email"),
  } satisfies ForgotPasswordInput;
}

export function validateResetPasswordInput(payload: Record<string, unknown>) {
  return {
    email: normalizeEmail(payload.email, "email"),
    otp: normalizeOtp(payload.otp),
    new_password: normalizePassword(payload.new_password),
  } satisfies ResetPasswordInput;
}

export async function upsertProfile(userId: string, input: UpdateProfileInput) {
  try {
    const result = await query<ProfileRecord>(
      `
        INSERT INTO profiles (user_id, full_name, contact_email)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id)
        DO UPDATE SET
          full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
          contact_email = COALESCE(EXCLUDED.contact_email, profiles.contact_email),
          updated_at = NOW()
        RETURNING user_id, full_name, contact_email, created_at, updated_at;
      `,
      [userId, input.full_name ?? null, input.contact_email ?? null],
    );

    return result.rows[0];
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
    ) {
      throw new AccountConflictError("That contact email is already in use.");
    }

    throw error;
  }
}

export async function changePasswordWithSupabaseSession(params: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  newPassword: string;
}) {
  const supabase = createSupabaseSessionClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  });

  if (sessionError || !sessionData.session) {
    throw new AccountOperationError(
      getSupabaseErrorMessage(sessionError, "A valid Supabase session is required."),
      getSupabaseErrorStatus(sessionError, 401),
    );
  }

  if (sessionData.session.user.id !== params.userId) {
    throw new AccountOperationError("The supplied tokens do not match the authenticated user.", 401);
  }

  const { error } = await supabase.auth.updateUser({
    password: params.newPassword,
  });

  if (error) {
    throw new AccountOperationError(
      getSupabaseErrorMessage(error, "Unable to change password."),
      getSupabaseErrorStatus(error, 400),
    );
  }
}

function resolvePasswordResetRedirect() {
  const directRedirect = process.env.PASSWORD_RESET_REDIRECT_TO?.trim();
  if (directRedirect) {
    return directRedirect;
  }

  const clientUrl = process.env.CLIENT_URL?.trim();
  if (!clientUrl) {
    return undefined;
  }

  return `${clientUrl.replace(/\/+$/, "")}/reset-password`;
}

export async function sendForgotPasswordOtp(input: ForgotPasswordInput) {
  const supabase = createSupabasePublicClient();
  const redirectTo = resolvePasswordResetRedirect();
  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, options);

  if (error) {
    throw new AccountOperationError(
      getSupabaseErrorMessage(error, "Unable to send password recovery code."),
      getSupabaseErrorStatus(error, 400),
    );
  }
}

export async function resetPasswordWithOtp(input: ResetPasswordInput) {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: input.email,
    token: input.otp,
    type: "recovery",
  });

  if (error || !data.session) {
    throw new AccountOperationError(
      getSupabaseErrorMessage(error, "Invalid or expired recovery code."),
      getSupabaseErrorStatus(error, 400),
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: input.new_password,
  });

  if (updateError) {
    throw new AccountOperationError(
      getSupabaseErrorMessage(updateError, "Unable to reset password."),
      getSupabaseErrorStatus(updateError, 400),
    );
  }
}
