import { create } from "zustand";
import {
  ApiError,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
  type AuthUser as User,
} from "@/lib/api";

interface Credentials {
  email: string;
  password: string;
}

interface SignupPayload extends Credentials {
  name: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  initialize: () => () => void;
  refreshUser: () => Promise<User | null>;
  login: (payload: Credentials) => Promise<User>;
  signup: (payload: SignupPayload) => Promise<User>;
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
      const { user } = await signupRequest(payload);
      if (!user) {
        throw new Error("Unable to create account.");
      }

      set({ user });
      return user;
    } catch (error) {
      throw new Error(toFriendlyMessage(error, "Unable to create account."));
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      set({ user: null });
    }
  },
}));
