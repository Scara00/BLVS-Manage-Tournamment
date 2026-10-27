import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { STATI_CATEGORIA, type Profilo, type StatoCategoria } from "./types";

export type ProfiloRow = {
  nome: string;
  cognome: string;
  email: string;
  categoria: Categoria | null;
};

/** Category lock from `public.stato_categoria()`, the same rule as the trigger. */
export async function readStatoCategoria(
  supabase: SupabaseClient,
  utenteId: string,
): Promise<StatoCategoria> {
  const { data, error } = await supabase.rpc("stato_categoria", {
    p_utente: utenteId,
  });
  if (error) throw new Error(`stato_categoria: ${error.message}`);
  if (!STATI_CATEGORIA.includes(data as StatoCategoria)) {
    throw new Error(`stato_categoria: valore inatteso ${String(data)}`);
  }
  return data as StatoCategoria;
}

export async function readProfiloRow(
  supabase: SupabaseClient,
  utenteId: string,
): Promise<ProfiloRow> {
  const { data, error } = await supabase
    .from("utenti")
    .select("nome, cognome, email, categoria")
    .eq("id", utenteId)
    .single<ProfiloRow>();
  if (error) throw new Error(`utenti: ${error.message}`);
  return data;
}

/**
 * The signed-in player's profile, or `null` without a valid session. The
 * email shown is the active one (`auth.users.email`, mirrored in `utenti`);
 * a change waiting for confirmation is `emailInAttesa`.
 */
export async function getProfilo(): Promise<Profilo | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: auth, error: authError } = await user.supabase.auth.getUser();
  if (authError || !auth.user) return null;

  const [row, statoCategoria] = await Promise.all([
    readProfiloRow(user.supabase, user.id),
    readStatoCategoria(user.supabase, user.id),
  ]);

  return {
    nome: row.nome,
    cognome: row.cognome,
    email: auth.user.email ?? row.email,
    emailConfermata: Boolean(auth.user.email_confirmed_at),
    emailInAttesa: auth.user.new_email || null,
    categoria: row.categoria,
    statoCategoria,
  };
}
