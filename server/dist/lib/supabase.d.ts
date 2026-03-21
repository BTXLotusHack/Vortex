import { type SupabaseClient } from "@supabase/supabase-js";
export declare class SupabaseConfigurationError extends Error {
    constructor(message: string);
}
export declare function getSupabaseUrl(): string;
export declare function getSupabaseAnonKey(): string;
export declare function getSupabaseServiceRoleKey(): string;
export declare function createSupabasePublicClient(): SupabaseClient<any, "public", "public", any, any>;
export declare function createSupabaseSessionClient(): SupabaseClient<any, "public", "public", any, any>;
export declare function getSupabaseAdminClient(): SupabaseClient<any, "public", "public", any, any>;
//# sourceMappingURL=supabase.d.ts.map