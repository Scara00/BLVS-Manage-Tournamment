import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import { getDemoTabelloneLive } from "@/lib/demo/admin-live";
import { publishBoardMatches, publishPendingScores } from "@/lib/live/publish";
import { now } from "@/lib/time/server-time";
import { CATEGORIA_NOME } from "@/lib/tappe/avvio/paths";
import { leggiDovePartita, leggiTabelloneLive } from "./dati";
import { isDaInserire } from "./format";
import { chiaveTabellone, type TabelloneLive } from "./types";

type Sorgente = { supabase: SupabaseClient | null };

function leggi(
  { supabase }: Sorgente,
  tappaId: string,
  categoria: Categoria,
  adesso: Date,
): Promise<TabelloneLive | null> | TabelloneLive | null {
  return supabase
    ? leggiTabelloneLive(supabase, tappaId, categoria, adesso)
    : getDemoTabelloneLive(tappaId, categoria, adesso);
}

/**
 * After a match changed: sends the board's matches to every open
 * w-admin-live (`board-matches`) and the stage's new count of results to
 * enter to the dashboard banner (`pending-scores`, BLVS-17). It re-reads
 * both boards, so the events carry what is saved. A failure is logged and
 * never undoes the write.
 */
export async function pubblicaTabellone(
  sorgente: Sorgente,
  tappaId: string,
  categoria: Categoria,
  cambio: string | null,
): Promise<void> {
  try {
    const adesso = now();
    const letti = await Promise.all(
      CATEGORIE.map((c) => leggi(sorgente, tappaId, c, adesso)),
    );
    const tabellone = letti[CATEGORIE.indexOf(categoria)];
    if (!tabellone) return;
    publishBoardMatches({
      id: chiaveTabellone(tappaId, categoria),
      stageId: tappaId,
      category: categoria,
      label: `${tabellone.tappa.nome}, ${CATEGORIA_NOME[categoria]}`,
      change: cambio,
      updatedAt: tabellone.lettoIl,
      matches: tabellone.partite,
    });
    publishPendingScores({
      id: tappaId,
      label: tabellone.tappa.nome,
      count: letti
        .flatMap((t) => t?.partite ?? [])
        .filter((p) => isDaInserire(p, adesso)).length,
    });
  } catch (error) {
    console.error("[admin-live] aggiornamento live non inviato", error);
  }
}

/** Same, for a match known only by id (score API). */
export async function pubblicaPartita(
  supabase: SupabaseClient,
  partitaId: string,
  cambio: string | null,
): Promise<void> {
  try {
    const dove = await leggiDovePartita(supabase, partitaId);
    if (dove) {
      await pubblicaTabellone(
        { supabase },
        dove.tappaId,
        dove.categoria,
        cambio,
      );
    }
  } catch (error) {
    console.error("[admin-live] aggiornamento live non inviato", error);
  }
}
