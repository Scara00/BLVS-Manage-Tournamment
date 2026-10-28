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
 * The signed-in user, verified on the server: `getClaims()` validates the
 * JWT signature, then the role is read from `public.utenti`. The role never
 * comes from the cookie, the JWT metadata or the request.
 * Returns `null` when nobody is signed in or Supabase is not configured.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!readSupabaseEnv()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;

  const { data: utente, error: profileError } = await supabase
    .from("utenti")
    .select("id, email, ruolo, anonimizzato_il")
    .eq("id", sub)
    .maybeSingle<{
      id: string;
      email: string;
      ruolo: Ruolo;
      anonimizzato_il: string | null;
    }>();

  if (profileError) {
    console.error("[auth] lettura del profilo non riuscita", profileError);
    return null;
  }
  // A deleted account (BLVS-50/53): its access token outlives the Auth user
  // until it expires.
  if (!utente || utente.anonimizzato_il) return null;

  const { id, email, ruolo } = utente;
  return { id, email, ruolo, supabase };
}
