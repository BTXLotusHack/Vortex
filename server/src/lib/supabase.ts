import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function requireEnv(name: string, value: string | undefined) {
  if (!value?.trim()) {
    throw new SupabaseConfigurationError(`Missing ${name} in environment configuration.`);
  }

  return value.trim();
}

export function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL", process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
}

export function getSupabaseAnonKey() {
  return requireEnv(
    "SUPABASE_ANON_KEY",
    process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function buildSupabaseClient(key: string) {
  return createClient(getSupabaseUrl(), key, serverAuthOptions);
}

let supabaseAdminClient: SupabaseClient | null = null;

export function createSupabasePublicClient() {
  return buildSupabaseClient(getSupabaseAnonKey());
}

export function createSupabaseSessionClient() {
  return buildSupabaseClient(getSupabaseAnonKey());
}

export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = buildSupabaseClient(getSupabaseServiceRoleKey());
  }

  return supabaseAdminClient;
}
