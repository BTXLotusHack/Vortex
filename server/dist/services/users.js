import "../env.js";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
export class AuthValidationError extends Error {
}
export class AuthConflictError extends Error {
}
export class AuthUnauthorizedError extends Error {
}
function isUniqueViolation(error) {
    return Boolean(error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505");
}
export function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
export function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ");
}
export function validateSignupInput(input) {
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
export function validateLoginInput(input) {
    const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!EMAIL_REGEX.test(email) || !password) {
        throw new AuthUnauthorizedError("Invalid email or password.");
    }
    return { email, password };
}
export async function createUserAccount(input) {
    const existing = await query(`
      SELECT id, email, name, avatar, password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `, [input.email]);
    const existingUser = existing.rows[0];
    if (existingUser?.password_hash) {
        throw new AuthConflictError("Unable to create account.");
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    if (existingUser) {
        const updated = await query(`
        UPDATE users
        SET name = $1, password_hash = $2
        WHERE id = $3
        RETURNING id, email, name, avatar;
      `, [input.name, passwordHash, existingUser.id]);
        return updated.rows[0];
    }
    try {
        const result = await query(`
        INSERT INTO users (id, email, name, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, avatar;
      `, [randomUUID(), input.email, input.name, passwordHash]);
        return result.rows[0];
    }
    catch (error) {
        if (isUniqueViolation(error)) {
            throw new AuthConflictError("Unable to create account.");
        }
        throw error;
    }
}
export async function authenticateUser(input) {
    const result = await query(`
      SELECT id, email, name, avatar, password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `, [input.email]);
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
    };
}
//# sourceMappingURL=users.js.map