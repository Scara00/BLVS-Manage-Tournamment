import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { demoStages, demoTappeGiocatore } from "@/lib/demo/tournament";
import { readProfiloRow } from "@/lib/profilo/read";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  demoTappaCard,
  toTappaCard,
  toTappeGiocatore,
  type PostiRow,
  type TappaCard,
  type TappaGiocatore,
  type TappaGiocatoreRow,
  type TappaRow,
} from "./format";

/**
 * The stage calendar, oldest first. RLS hides drafts from everyone but
 * admins. Without Supabase env (CI, e2e) it returns the demo stages.
 */
export async function readTappe(): Promise<TappaCard[]> {
  if (!readSupabaseEnv()) return demoStages.map(demoTappaCard);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tappe")
    .select("id, nome, luogo, data_inizio, data_fine, stato")
    .order("data_inizio", { ascending: true });
  if (error) throw new Error(`tappe: ${error.message}`);
  return (data as TappaRow[]).map(toTappaCard);
}

/** What the player list (w-tappe) needs in one read. */
export type ElencoTappe = {
  tappe: TappaGiocatore[];
  /** The signed-in player's category; null without a session or category. */
  categoria: Categoria | null;
  /** A player is signed in (seats are shown only to signed-in players). */
  connesso: boolean;
};

/**
 * Non-draft stages with seats in the player's category, deadline and phase.
 * Seats come from RPC `posti_tappe()`, because RLS hides other players'
 * registrations. Without Supabase env (CI, e2e) it returns the demo list.
 */
export async function readElencoTappe(): Promise<ElencoTappe> {
  if (!readSupabaseEnv()) {
    const demo = demoTappeGiocatore;
    return {
      tappe: toTappeGiocatore(demo.tappe, demo.posti, demo.categoria),
      categoria: demo.categoria,
      connesso: true,
    };
  }

  const supabase = await createClient();
  const [user, tappe, posti] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("tappe")
      .select(
        "id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il",
      )
      .neq("stato", "bozza")
      .order("data_inizio", { ascending: true }),
    supabase.rpc("posti_tappe"),
  ]);
  if (tappe.error) throw new Error(`tappe: ${tappe.error.message}`);
  if (posti.error) throw new Error(`posti_tappe: ${posti.error.message}`);

  const categoria = user
    ? (await readProfiloRow(user.supabase, user.id)).categoria
    : null;

  return {
    tappe: toTappeGiocatore(
      tappe.data as TappaGiocatoreRow[],
      posti.data as PostiRow[],
      categoria,
    ),
    categoria,
    connesso: user !== null,
  };
}
