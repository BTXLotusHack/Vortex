import { create } from "zustand";
import {
  ApiError,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  resendSignupOtp as resendSignupOtpRequest,
  signup as signupRequest,
  verifySignupOtp as verifySignupOtpRequest,
  type AuthUser as User,
} from "@/lib/api";

interface Credentials {
  email: string;
  password: string;
}

interface SignupPayload extends Credentials {
  name: string;
}

interface SignupPendingState {
  email: string;
  message: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  pendingSignup: SignupPendingState | null;
  initialize: () => () => void;
  refreshUser: () => Promise<User | null>;
  login: (payload: Credentials) => Promise<User>;
  signup: (payload: SignupPayload) => Promise<SignupPendingState>;
  verifySignupOtp: (payload: { email: string; otp: string }) => Promise<User>;
  resendSignupOtp: (payload: { email: string }) => Promise<SignupPendingState>;
  clearPendingSignup: () => void;
  logout: () => Promise<void>;
}

function toFriendlyMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  pendingSignup: null,

  initialize: () => {
    let active = true;

    void getCurrentUser()
      .then(({ user }) => {
        if (!active) return;
        set({ user, isLoading: false });
      })
      .catch(() => {
        if (!active) return;
        set({ user: null, isLoading: false });
      });

    return () => {
      active = false;
    };
  },

  refreshUser: async () => {
    const { user } = await getCurrentUser();
    set({ user });
    return user;
  },

  login: async (payload) => {
    try {
      const { user } = await loginRequest(payload);
      if (!user) {
        throw new Error("Invalid email or password.");
      }

      set({ user });
      return user;
    } catch (error) {
      throw new Error(toFriendlyMessage(error, "Invalid email or password."));
    }
  },

  signup: async (payload) => {
    try {
      const pendingSignup = await signupRequest(payload);
      set({ pendingSignup });
      return pendingSignup;
    } catch (error) {
      throw new Error(toFriendlyMessage(error, "Unable to create account."));
    }
  },

  verifySignupOtp: async (payload) => {
    try {
      const { user } = await verifySignupOtpRequest(payload);
      if (!user) {
        throw new Error("Invalid or expired OTP.");
      }

      set({ user, pendingSignup: null });
      return user;
    } catch (error) {
      throw new Error(toFriendlyMessage(error, "Invalid or expired OTP."));
    }
  },

  resendSignupOtp: async (payload) => {
    try {
      const pendingSignup = await resendSignupOtpRequest(payload);
      set({ pendingSignup });
      return pendingSignup;
    } catch (error) {
      throw new Error(toFriendlyMessage(error, "Unable to resend OTP."));
    }
  },

  clearPendingSignup: () => {
    set({ pendingSignup: null });
  },

  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      set({ user: null });
    }
  },
}));
