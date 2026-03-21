import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  initialize: () => () => void;
  logout: () => Promise<void>;
}

function mapUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "User",
    avatar: u.user_metadata?.avatar_url,
  };
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,

  initialize: () => {
    // Listen first, then get session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        user: session?.user ? mapUser(session.user) : null,
        isLoading: false,
      });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        user: session?.user ? mapUser(session.user) : null,
        isLoading: false,
      });
    });

    return () => subscription.unsubscribe();
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
