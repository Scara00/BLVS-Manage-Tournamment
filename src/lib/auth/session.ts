import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ruolo } from "@/lib/db/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  ruolo: Ruolo;
  /** Client bound to the user's session: every query goes through RLS. */
  supabase: SupabaseClient;
};

/**
 * `readCurrentUser()`: `signedOut` also covers a valid session whose profile
 * is gone (a deleted account); `error` is a profile that could not be read
 * (the user may well be signed in).
 */
export type CurrentUserResult =
  | { status: "ok"; user: CurrentUser }
  | { status: "signedOut" }
  | { status: "error" };

/**
 * The signed-in user, verified on the server: `getClaims()` validates the
 * JWT signature, then the role is read from `public.utenti`. The role never
 * comes from the cookie, the JWT metadata or the request.
 * Returns `null` when nobody is signed in or Supabase is not configured.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await readCurrentUser();
  return result.status === "ok" ? result.user : null;
}

/** `getCurrentUser()` that also tells a failed profile read apart. */
export async function readCurrentUser(): Promise<CurrentUserResult> {
  if (!readSupabaseEnv()) return { status: "signedOut" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return { status: "signedOut" };

  const { data: utente, error: profileError } = await supabase
    .from("utenti")
    .select("id, email, ruolo")
    .eq("id", sub)
    .maybeSingle<{ id: string; email: string; ruolo: Ruolo }>();

  if (profileError) {
    console.error("[auth] lettura del profilo non riuscita", profileError);
    return { status: "error" };
  }
  // A deleted account: its access token outlives the Auth user until it
  // expires. The proxy signs such a session out (`updateSession`).
  if (!utente) return { status: "signedOut" };

  const { id, email, ruolo } = utente;
  return { status: "ok", user: { id, email, ruolo, supabase } };
}
