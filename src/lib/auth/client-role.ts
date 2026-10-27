import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * What the browser can tell about the current user right now:
 * - `admin`: still signed in as admin;
 * - `denied`: signed in, but the role (re-read from `public.utenti`) is not admin;
 * - `expired`: the session is gone;
 * - `unknown`: the check could not run (offline, Supabase down): change nothing.
 */
export type ClientRoleCheck = "admin" | "denied" | "expired" | "unknown";

/** Re-reads the session and the role from Supabase, in the browser. */
export async function checkAdminInBrowser(): Promise<ClientRoleCheck> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error && !isAuthSessionMissingError(error)) return "unknown";
    const id = data.user?.id;
    if (!id) return "expired";

    const { data: utente, error: profileError } = await supabase
      .from("utenti")
      .select("ruolo")
      .eq("id", id)
      .maybeSingle<{ ruolo: string }>();
    if (profileError) return "unknown";
    return utente?.ruolo === "admin" ? "admin" : "denied";
  } catch {
    return "unknown";
  }
}
