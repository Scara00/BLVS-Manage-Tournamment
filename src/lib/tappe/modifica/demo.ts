import type { Categoria } from "@/lib/db/types";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { POSTI_PREDEFINITI } from "@/lib/tappe/nuova/types";
import { toRomeLocal } from "@/lib/time/rome-local";
import type { TabelloneModifica, TappaModifica } from "./types";

/**
 * A demo stage (no Supabase env) for the edit form, from the same
 * in-memory store as the management page (BLVS-20), so both show the same
 * data. Demo boards without a maximum get the default one.
 */
export function demoTappaModifica(id: string): TappaModifica | null {
  const demo = getDemoTappaGestione(id);
  if (!demo) return null;
  const { row } = demo;
  const tabelloni = {
    M: { posti: POSTI_PREDEFINITI, iscritti: 0 },
    F: { posti: POSTI_PREDEFINITI, iscritti: 0 },
  } as Record<Categoria, TabelloneModifica>;
  for (const t of demo.tabelloni) {
    const iscritti = t.confermate + t.inAttesa;
    tabelloni[t.categoria] = {
      posti: Math.max(demo.posti ?? POSTI_PREDEFINITI, iscritti),
      iscritti,
    };
  }
  return {
    id: row.id,
    nome: row.nome,
    luogo: row.luogo,
    data: row.data_inizio,
    dataFine: row.data_fine,
    scadenza: row.iscrizioni_chiudono_il
      ? toRomeLocal(new Date(row.iscrizioni_chiudono_il))
      : "",
    stato: row.stato,
    versione: 1,
    tabelloni,
  };
}
