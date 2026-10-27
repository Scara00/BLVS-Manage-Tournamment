import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria, FaseGioco, StatoTappa } from "@/lib/db/types";
import { getDemoAvvioFase } from "@/lib/demo/avvio-fase";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { toAvvioFaseView, type AvvioFaseView } from "./format";
import { toProblemi, type ProblemaDb } from "./errori";
import {
  controllaAvvio,
  type GiocatoreAvvio,
  type ProblemaAvvio,
  type TabelloneAvvio,
} from "./regole";

type GiocatoreDb = {
  lettera: string;
  iscrizione_id: string;
  utente_id: string;
  nome: string;
  cognome: string;
};

type IscrizioneDb = {
  id: string;
  utenti: { nome: string; cognome: string } | null;
};

async function readFromDb(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<{ tabellone: TabelloneAvvio; problemi: ProblemaAvvio[] } | null> {
  const { data: tappa, error: tappaError } = await supabase
    .from("tappe")
    .select("id, nome, stato, tabelloni (id, categoria, fase_gioco)")
    .eq("id", tappaId)
    .maybeSingle();
  if (tappaError) throw new Error(`tappa: ${tappaError.message}`);
  if (!tappa) return null;
  const row = tappa as unknown as {
    id: string;
    nome: string;
    stato: StatoTappa;
    tabelloni: {
      id: string;
      categoria: Categoria;
      fase_gioco: FaseGioco | null;
    }[];
  };
  const board = row.tabelloni.find((t) => t.categoria === categoria);
  if (!board) return null;

  const [gironi, iscrizioni, controlli] = await Promise.all([
    supabase
      .from("gironi")
      .select("id, nome")
      .eq("tabellone_id", board.id)
      .order("posizione")
      .order("nome"),
    supabase
      .from("iscrizioni")
      .select("id, utenti (nome, cognome)")
      .eq("tabellone_id", board.id)
      .eq("stato", "confermata"),
    supabase.rpc("controlli_avvio_fase", { p_tabellone: board.id }),
  ]);
  if (gironi.error) throw new Error(`gironi: ${gironi.error.message}`);
  if (iscrizioni.error) {
    throw new Error(`iscrizioni: ${iscrizioni.error.message}`);
  }
  if (controlli.error) {
    throw new Error(`controlli: ${controlli.error.message}`);
  }

  // The letters come from the database, so the preview matches the
  // matches `avvia_fase` creates.
  const giocatori = await Promise.all(
    (gironi.data as { id: string; nome: string }[]).map(async (g) => {
      const { data, error } = await supabase.rpc("giocatori_girone", {
        p_girone: g.id,
      });
      if (error) throw new Error(`giocatori: ${error.message}`);
      return (data as GiocatoreDb[]).map((p): GiocatoreAvvio => ({
        iscrizioneId: p.iscrizione_id,
        utenteId: p.utente_id,
        lettera: p.lettera,
        nome: p.nome,
        cognome: p.cognome,
      }));
    }),
  );
  const assegnati = new Set(giocatori.flat().map((p) => p.iscrizioneId));

  return {
    tabellone: {
      tappa: { id: row.id, nome: row.nome, stato: row.stato },
      categoria,
      tabelloneId: board.id,
      faseGioco: board.fase_gioco,
      gironi: (gironi.data as { id: string; nome: string }[]).map((g, i) => ({
        id: g.id,
        nome: g.nome,
        giocatori: giocatori[i],
      })),
      nonAssegnati: (iscrizioni.data as unknown as IscrizioneDb[])
        .filter((i) => !assegnati.has(i.id))
        .map((i) => ({
          iscrizioneId: i.id,
          nome: i.utenti?.nome ?? "",
          cognome: i.utenti?.cognome ?? "",
        })),
    },
    problemi: toProblemi(controlli.data as ProblemaDb[]),
  };
}

/**
 * w-admin-avvio-fase of one board, read through RLS with the admin's
 * session: a player gets 403, an unknown stage 404. The checks come from
 * `controlli_avvio_fase`, the same function that guards the start.
 * Without Supabase env it reads the in-memory demo groups.
 */
export async function readAvvioFase(
  tappaId: string,
  categoria: Categoria,
): Promise<AvvioFaseView> {
  await connection();
  if (!readSupabaseEnv()) {
    const tabellone = getDemoAvvioFase(tappaId, categoria);
    if (!tabellone) notFound();
    return toAvvioFaseView(tabellone, controllaAvvio(tabellone));
  }

  if (!isUuid(tappaId)) notFound();
  const user = await getCurrentUser();
  if (user?.ruolo !== "admin") forbidden();
  const letto = await readFromDb(user.supabase, tappaId, categoria);
  if (!letto) notFound();
  return toAvvioFaseView(letto.tabellone, letto.problemi);
}
