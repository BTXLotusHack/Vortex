import { Router } from "express";
import {
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
  updateProfileController,
} from "../controllers/account.js";
import { requireSupabaseAuth } from "../middleware/supabaseAuth.js";

export const accountRouter = Router();

accountRouter.put("/profile", requireSupabaseAuth, updateProfileController);
accountRouter.post("/change-password", requireSupabaseAuth, changePasswordController);
accountRouter.post("/forgot-password", forgotPasswordController);
accountRouter.post("/reset-password", resetPasswordController);
