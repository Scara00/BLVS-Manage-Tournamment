import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria, FaseGioco, StatoIscrizione } from "@/lib/db/types";
import { getDemoConclusoIl } from "@/lib/demo/admin-live";
import {
  chiudiDemoScadute,
  getDemoTappaGestione,
  listDemoTappeGestione,
} from "@/lib/demo/gestione-tappe";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import {
  TAPPA_GESTIONE_COLUMNS,
  toGestioneTappaView,
  toTappaAdminItem,
  type GestioneTappaView,
  type TabelloneRow,
  type TappaAdminItem,
  type TappaGestioneRow,
} from "./gestione-format";

/**
 * Closes expired registrations before reading, so the page never shows
 * «aperte» past the deadline even if the cron has not run yet. A failure
 * is only logged: the cron and the RLS policy still cover it.
 */
async function chiudiScadute(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("chiudi_iscrizioni_scadute");
  if (error) console.error("[tappe] chiusura automatica non riuscita", error);
}

async function adminClient(): Promise<SupabaseClient> {
  const user = await getCurrentUser();
  if (user?.ruolo !== "admin") forbidden();
  return user.supabase;
}

/** Every stage for the admin list, drafts included, oldest first. */
export async function readTappeAdmin(): Promise<TappaAdminItem[]> {
  await connection();
  const at = now();
  if (!readSupabaseEnv()) {
    chiudiDemoScadute(at);
    return listDemoTappeGestione().map(({ row }) => toTappaAdminItem(row, at));
  }

  const supabase = await adminClient();
  await chiudiScadute(supabase);
  const { data, error } = await supabase
    .from("tappe")
    .select(TAPPA_GESTIONE_COLUMNS)
    .order("data_inizio", { ascending: true });
  if (error) throw new Error(`tappe: ${error.message}`);
  return (data as TappaGestioneRow[]).map((row) => toTappaAdminItem(row, at));
}

type TabelloneDb = {
  id: string;
  categoria: Categoria;
  fase_gioco: FaseGioco | null;
  concluso_il: string | null;
  iscrizioni: { stato: StatoIscrizione }[];
  partite: { fase: string }[];
};

async function readFromDb(
  supabase: SupabaseClient,
  id: string,
): Promise<{ row: TappaGestioneRow; tabelloni: TabelloneRow[] } | null> {
  const { data, error } = await supabase
    .from("tappe")
    .select(
      `${TAPPA_GESTIONE_COLUMNS}, tabelloni (id, categoria, fase_gioco, concluso_il, iscrizioni (stato), partite (fase))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!data) return null;

  const { tabelloni, ...row } = data as unknown as TappaGestioneRow & {
    tabelloni: TabelloneDb[];
  };
  return {
    row,
    tabelloni: tabelloni.map((t) => ({
      categoria: t.categoria,
      confermate: t.iscrizioni.filter((i) => i.stato === "confermata").length,
      inAttesa: t.iscrizioni.filter((i) => i.stato === "in_attesa").length,
      fasiPartite: t.partite.map((p) => p.fase),
      faseGioco: t.fase_gioco,
      conclusoIl: t.concluso_il,
    })),
  };
}

/**
 * The management page of one stage, read through RLS with the admin's
 * session; a player gets 403, an unknown id 404. Without Supabase env it
 * reads the in-memory demo stages.
 */
export async function readGestioneTappa(
  id: string,
): Promise<GestioneTappaView> {
  await connection();
  const at = now();
  if (!readSupabaseEnv()) {
    chiudiDemoScadute(at);
    const tappa = getDemoTappaGestione(id);
    if (!tappa) notFound();
    // BLVS-43: the boards closed on w-admin-live's demo store.
    const tabelloni = tappa.tabelloni.map((t) => ({
      ...t,
      conclusoIl: getDemoConclusoIl(id, t.categoria),
    }));
    return toGestioneTappaView(tappa.row, tabelloni, at);
  }

  if (!isUuid(id)) notFound();
  const supabase = await adminClient();
  await chiudiScadute(supabase);
  const tappa = await readFromDb(supabase, id);
  if (!tappa) notFound();
  return toGestioneTappaView(tappa.row, tappa.tabelloni, at);
}
