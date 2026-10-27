import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseEnv, readSupabaseSecretKey } from "./env";

let client: SupabaseClient | null | undefined;

/**
 * Supabase client with the secret key: it bypasses RLS, so it is only for
 * server-side bookkeeping (e.g. the rate limiter), never for user data.
 * Returns `null` when the secret key or the project URL is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = readSupabaseEnv();
  const secretKey = readSupabaseSecretKey();
  client =
    env && secretKey
      ? createClient(env.url, secretKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return client;
}
