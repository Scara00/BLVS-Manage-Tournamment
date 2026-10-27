import { createClient } from "@supabase/supabase-js";

/**
 * Local Supabase stack (`supabase start`). CI exports these with
 * `supabase status -o env`; locally the defaults match a fresh `supabase start`.
 */
export const supabaseLocal = {
  url: process.env.API_URL ?? "http://127.0.0.1:54321",
  anonKey: process.env.ANON_KEY ?? "",
  serviceRoleKey: process.env.SERVICE_ROLE_KEY ?? "",
  /** `[edge_runtime.secrets]` in supabase/config.toml (local value only). */
  emailWorkerSecret:
    process.env.EMAIL_WORKER_SECRET ?? "blvs-locale-solo-sviluppo",
};

export function isSupabaseLocalConfigured() {
  return Boolean(supabaseLocal.anonKey && supabaseLocal.serviceRoleKey);
}

export function adminClient() {
  return createClient(supabaseLocal.url, supabaseLocal.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient() {
  return createClient(supabaseLocal.url, supabaseLocal.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A fresh address per test, so parallel runs never read each other's mail. */
export function uniqueAddress(prefix: string) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@example.test`;
}
