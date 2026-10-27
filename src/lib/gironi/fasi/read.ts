import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria, FaseGioco, FaseGirone } from "@/lib/db/types";
import { getDemoFaseTabellone } from "@/lib/demo/avvio-fase";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { classificaDemo } from "@/lib/demo/punteggi";
import { leggiClassificaGirone } from "@/lib/gironi/classifica";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { GironeClassificato } from "./qualificazione";
import type { TipoProssimaFase, ProssimaFaseView } from "./types";
import { vistaProssimaFase, type DatiProssimaFase } from "./vista";

/** The group phases read for each step: the phase just played. */
const FASI_GIOCATE: Record<TipoProssimaFase, FaseGirone[]> = {
  gold_silver: ["iniziale"],
  finali: ["gold", "silver"],
};

type GiocatoreDb = { iscrizione_id: string; nome: string; cognome: string };

/**
 * The board, its phase and the groups of the phase just played with their
 * standings (BLVS-27, computed on read), through RLS as the admin.
 */
export async function leggiDatiProssimaFase(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
  tipo: TipoProssimaFase,
): Promise<(DatiProssimaFase & { tabelloneId: string }) | null> {
  const { data: tappa, error } = await supabase
    .from("tappe")
    .select("id, nome, tabelloni (id, categoria, fase_gioco)")
    .eq("id", tappaId)
    .maybeSingle();
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!tappa) return null;
  const row = tappa as unknown as {
    id: string;
    nome: string;
    tabelloni: {
      id: string;
      categoria: Categoria;
      fase_gioco: FaseGioco | null;
    }[];
  };
  const board = row.tabelloni.find((t) => t.categoria === categoria);
  if (!board) return null;

  const { data: gironi, error: gironiError } = await supabase
    .from("gironi")
    .select("id, nome, fase")
    .eq("tabellone_id", board.id)
    .order("posizione")
    .order("nome");
  if (gironiError) throw new Error(`gironi: ${gironiError.message}`);
  const tutti = gironi as { id: string; nome: string; fase: FaseGirone }[];
  const giocati = tutti.filter((g) => FASI_GIOCATE[tipo].includes(g.fase));

  const classificati = await Promise.all(
    giocati.map(async (g): Promise<GironeClassificato> => {
      const [classifica, giocatori] = await Promise.all([
        leggiClassificaGirone(supabase, g.id),
        supabase.rpc("giocatori_girone", { p_girone: g.id }),
      ]);
      if (giocatori.error) {
        throw new Error(`giocatori: ${giocatori.error.message}`);
      }
      const nomi = Object.fromEntries(
        (giocatori.data as GiocatoreDb[]).map((p) => [
          p.iscrizione_id,
          `${p.nome} ${p.cognome}`.trim(),
        ]),
      );
      return { id: g.id, nome: g.nome, fase: g.fase, nomi, classifica };
    }),
  );

  return {
    tabelloneId: board.id,
    tappa: { id: row.id, nome: row.nome },
    categoria,
    faseGioco: board.fase_gioco,
    proposta: tutti.some((g) => g.fase === "gold" || g.fase === "silver"),
    gironi: classificati,
  };
}

/** The same data from the in-memory demo stores (no Supabase env). */
export function datiDemoProssimaFase(
  tappaId: string,
  categoria: Categoria,
): DatiProssimaFase | null {
  const tappa = getDemoTappaGestione(tappaId);
  const board = getDemoFaseTabellone(tappaId, categoria);
  if (!tappa || !board) return null;
  return {
    tappa: { id: tappaId, nome: tappa.row.nome },
    categoria,
    faseGioco: board.faseGioco,
    proposta: board.proposta,
    gironi: board.gironi.map((g) => ({
      id: g.id,
      nome: g.nome,
      fase: g.fase ?? "iniziale",
      nomi: Object.fromEntries(
        g.giocatori.map((p) => [p.iscrizioneId, `${p.nome} ${p.cognome}`]),
      ),
      classifica: classificaDemo(tappaId, g.id),
    })),
  };
}

/**
 * The next-phase panel of one board (w-admin-gironi for gold/silver,
 * w-admin-avvio-fase for the finals), or null when it doesn't apply.
 */
export async function readProssimaFase(
  tappaId: string,
  categoria: Categoria,
  tipo: TipoProssimaFase,
): Promise<ProssimaFaseView | null> {
  await connection();
  if (!readSupabaseEnv()) {
    const dati = datiDemoProssimaFase(tappaId, categoria);
    return dati ? vistaProssimaFase(tipo, dati) : null;
  }
  if (!isUuid(tappaId)) return null;
  const user = await getCurrentUser();
  if (user?.ruolo !== "admin") forbidden();
  const dati = await leggiDatiProssimaFase(
    user.supabase,
    tappaId,
    categoria,
    tipo,
  );
  return dati ? vistaProssimaFase(tipo, dati) : null;
}
