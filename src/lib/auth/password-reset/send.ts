import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseEnv } from "@/lib/supabase/env";

/**
 * Asks Supabase Auth to email a recovery link to `email`. Supabase stores
 * only the hash of the one-time token, expires it after `otp_expiry` and
 * sends the BLVS-08 Italian template; for an unknown address it does
 * nothing and still answers OK.
 *
 * A cookie-less client in the implicit flow: the PKCE flow would tie the
 * link to a code verifier in this browser's cookies, and `{{ .TokenHash }}`
 * must be the plain hash that `verifyOtp` accepts on any device.
 * Never throws: the caller has already answered the user.
 */
export async function sendRecoveryEmail(
  env: SupabaseEnv,
  email: string,
): Promise<void> {
  try {
    const supabase = createClient(env.url, env.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "implicit",
      },
    });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    // The address is not logged: it would tell who asked for a reset.
    if (error)
      console.error("[auth] invio email di recupero non riuscito", error);
  } catch (error) {
    console.error("[auth] invio email di recupero non riuscito", error);
  }
}
