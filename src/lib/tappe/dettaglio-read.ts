import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria, StatoIscrizione } from "@/lib/db/types";
import {
  DEMO_GIOCATORE_COOKIE,
  demoDettaglioTappa,
  demoPostoPreso,
  demoTabelloniTappa,
} from "@/lib/demo/tappa-dettaglio";
import { demoTappeGiocatore } from "@/lib/demo/tournament";
import { readProfiloRow } from "@/lib/profilo/read";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { now } from "@/lib/time/server-time";
import {
  DETTAGLIO_TAPPA_COLUMNS,
  iscrizioneAttiva,
  toIscrizioneConfermata,
  toTappaDettaglio,
  type DettaglioTappaRow,
  type IscrizioneConfermata,
  type IscrizionePropria,
  type TabelloneTappaRow,
  type TappaDettaglio,
} from "./dettaglio";
import { tappaHref } from "./paths";

type Lettura = {
  row: DettaglioTappaRow;
  tabelloni: TabelloneTappaRow[];
  categoria: Categoria | null;
  iscrizione: IscrizionePropria | null;
};

/**
 * Everything the detail needs. A draft or a missing stage throws
 * `notFound()` for everyone: drafts never reach the player pages (RLS
 * hides them from players anyway). Without Supabase env it reads the demo.
 */
async function leggiTappa(id: string): Promise<Lettura> {
  if (!readSupabaseEnv()) {
    const row = demoDettaglioTappa(id);
    if (!row || row.stato === "bozza") notFound();
    const giocatore = (await cookies()).get(DEMO_GIOCATORE_COOKIE)?.value;
    const posto = demoPostoPreso(giocatore, id);
    return {
      row,
      tabelloni: demoTabelloniTappa(id, posto ? 1 : 0),
      categoria: demoTappeGiocatore.categoria,
      iscrizione: posto
        ? { posto, stato: "in_attesa", categoria: demoTappeGiocatore.categoria }
        : null,
    };
  }

  if (!isUuid(id)) notFound();
  const user = await getCurrentUser();
  const supabase = user?.supabase ?? (await createClient());

  const [tappa, tabelloni] = await Promise.all([
    supabase
      .from("tappe")
      .select(DETTAGLIO_TAPPA_COLUMNS)
      .eq("id", id)
      .neq("stato", "bozza")
      .maybeSingle<DettaglioTappaRow>(),
    supabase.rpc("tabelloni_tappa", { p_tappa: id }),
  ]);
  if (tappa.error) throw new Error(`tappe: ${tappa.error.message}`);
  if (!tappa.data) notFound();
  if (tabelloni.error)
    throw new Error(`tabelloni_tappa: ${tabelloni.error.message}`);

  let categoria: Categoria | null = null;
  let iscrizione: IscrizionePropria | null = null;
  if (user) {
    const [profilo, propria] = await Promise.all([
      readProfiloRow(user.supabase, user.id),
      user.supabase
        .from("iscrizioni")
        .select("posto, stato, tabelloni (categoria)")
        .eq("tappa_id", id)
        .eq("utente_id", user.id)
        .maybeSingle<{
          posto: number | null;
          stato: StatoIscrizione;
          tabelloni: { categoria: Categoria } | null;
        }>(),
    ]);
    if (propria.error) throw new Error(`iscrizioni: ${propria.error.message}`);
    categoria = profilo.categoria;
    if (propria.data) {
      iscrizione = {
        posto: propria.data.posto,
        stato: propria.data.stato,
        categoria:
          propria.data.tabelloni?.categoria ?? profilo.categoria ?? "M",
      };
    }
  }

  return {
    row: tappa.data,
    tabelloni: tabelloni.data as TabelloneTappaRow[],
    categoria,
    iscrizione,
  };
}

/** w-tappa for the signed-in player, with the server clock (Europe/Rome). */
export async function readTappaDettaglio(id: string): Promise<TappaDettaglio> {
  const lettura = await leggiTappa(id);
  // The reason depends on the clock: request time only, never a prerender.
  await connection();
  return toTappaDettaglio(lettura.row, lettura.tabelloni, {
    categoria: lettura.categoria,
    iscrizione: lettura.iscrizione,
    at: now(),
  });
}

/**
 * w-iscrizione-ok. Without an active registration to this stage the player
 * goes back to the stage detail.
 */
export async function readIscrizioneConfermata(
  id: string,
): Promise<IscrizioneConfermata> {
  const { row, iscrizione } = await leggiTappa(id);
  if (!iscrizione || !iscrizioneAttiva(iscrizione)) redirect(tappaHref(id));
  return toIscrizioneConfermata(row, iscrizione);
}
