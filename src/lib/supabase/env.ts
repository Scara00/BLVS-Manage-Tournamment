export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

/** Returns the public Supabase config, or `null` when it is not configured. */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();

  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  return env;
}

/**
 * Server-only secret key (`sb_secret_…`), used for the few operations no
 * user may perform, such as the auth rate-limit counter. `null` when unset.
 */
export function readSupabaseSecretKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY || null;
}
