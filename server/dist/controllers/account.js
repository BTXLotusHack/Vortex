import { SupabaseConfigurationError } from "../lib/supabase.js";
import { AccountConflictError, AccountOperationError, AccountValidationError, changePasswordWithSupabaseSession, sendForgotPasswordOtp, resetPasswordWithOtp, upsertProfile, validateForgotPasswordInput, validatePasswordChangeInput, validateProfileUpdateInput, validateResetPasswordInput, } from "../services/account.js";
function handleAccountError(res, error, fallbackMessage) {
    if (error instanceof AccountValidationError) {
        return res.status(400).json({ error: error.message });
    }
    if (error instanceof AccountConflictError) {
        return res.status(409).json({ error: error.message });
    }
    if (error instanceof AccountOperationError) {
        return res.status(error.status).json({ error: error.message });
    }
    if (error instanceof SupabaseConfigurationError) {
        return res.status(500).json({ error: "Supabase authentication is not configured." });
    }
    console.error(fallbackMessage, error);
    return res.status(500).json({ error: fallbackMessage });
}
export async function updateProfileController(req, res) {
    try {
        const userId = req.supabaseUser?.id;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required." });
        }
        const input = validateProfileUpdateInput((req.body || {}));
        const profile = await upsertProfile(userId, input);
        return res.status(200).json({ profile });
    }
    catch (error) {
        return handleAccountError(res, error, "Unable to update profile.");
    }
}
export async function changePasswordController(req, res) {
    try {
        const userId = req.supabaseUser?.id;
        const accessToken = req.supabaseAccessToken;
        const refreshToken = req.supabaseRefreshToken;
        if (!userId || !accessToken) {
            return res.status(401).json({ error: "Authentication required." });
        }
        if (!refreshToken) {
            return res.status(400).json({
                error: "A Supabase refresh token is required in the x-refresh-token header.",
            });
        }
        const input = validatePasswordChangeInput((req.body || {}));
        await changePasswordWithSupabaseSession({
            accessToken,
            refreshToken,
            userId,
            newPassword: input.new_password,
        });
        return res.status(200).json({ message: "Password updated successfully." });
    }
    catch (error) {
        return handleAccountError(res, error, "Unable to change password.");
    }
}
export async function forgotPasswordController(req, res) {
    try {
        const input = validateForgotPasswordInput((req.body || {}));
        await sendForgotPasswordOtp(input);
        return res.status(200).json({
            message: "If an account exists for that email, a recovery code has been sent.",
        });
    }
    catch (error) {
        return handleAccountError(res, error, "Unable to send password recovery code.");
    }
}
export async function resetPasswordController(req, res) {
    try {
        const input = validateResetPasswordInput((req.body || {}));
        await resetPasswordWithOtp(input);
        return res.status(200).json({ message: "Password reset successfully." });
    }
    catch (error) {
        return handleAccountError(res, error, "Unable to reset password.");
    }
}
//# sourceMappingURL=account.js.map