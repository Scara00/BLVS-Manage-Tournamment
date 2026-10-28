import "server-only";
import { CATEGORIE } from "@/lib/db/types";
import {
  nomeTappaDemo,
  stagioneTappaDemo,
} from "@/lib/demo/classifica-generale";
import { publishOverallPlayerStandings } from "@/lib/live/publish";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { calcolaClassificaGenerale } from "./read";

/**
 * Publishes the overall standing of the stage's season, both categories,
 * after a change that can move stage points: a score saved, corrected or
 * undone, a tie decided, the finals created, a board closed (BLVS-43).
 * Call it after the write commits. It never throws: a failed publish is
 * logged and the next page load (or resync) still reads fresh data.
 *
 * `cambio` is the one sentence the announcer adds, e.g. «Tappa 2 · Rimini:
 * punti definitivi»; it defaults to «<stage>: punti aggiornati».
 */
export async function pubblicaClassificaGenerale(
  tappaId: string,
  cambio?: string,
): Promise<void> {
  try {
    let tappa: { nome: string; stagione: number } | null;
    if (!readSupabaseEnv()) {
      const stagione = stagioneTappaDemo(tappaId);
      tappa =
        stagione === null
          ? null
          : { nome: nomeTappaDemo(tappaId) ?? tappaId, stagione };
    } else {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("tappe")
        .select("nome, stagione")
        .eq("id", tappaId)
        .maybeSingle<{ nome: string; stagione: number }>();
      if (error) throw error;
      tappa = data;
    }
    if (!tappa) return;
    const change = cambio ?? `${tappa.nome}: punti aggiornati`;
    for (const categoria of CATEGORIE) {
      publishOverallPlayerStandings(
        await calcolaClassificaGenerale(categoria, tappa.stagione, change),
      );
    }
  } catch (error) {
    console.error("[classifica generale] pubblicazione non riuscita", error);
  }
}
