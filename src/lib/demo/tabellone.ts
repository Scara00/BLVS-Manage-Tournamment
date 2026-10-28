import { CATEGORIE } from "@/lib/db/types";
import { getDemoConclusoIl } from "./admin-live";
import { getDemoFaseTabellone, getDemoGironiGiocati } from "./avvio-fase";
import { getDemoTappaGestione } from "./gestione-tappe";
import { classificaDemo } from "./punteggi";
import { getDemoAssenze } from "./ritiri";
import type { DatiTabellone, GironeDati } from "@/lib/tabellone/dati";
import { noteAssenze } from "@/lib/ritiri/format";

/**
 * w-tabellone's data from the in-memory demo stores (no Supabase env):
 * the groups of every played level (BLVS-39 demo boards), their standings
 * from the demo scores, the closed flags of BLVS-43 and the absences of
 * BLVS-42. Null for an unknown stage or a draft.
 */
export function getDemoDatiTabellone(tappaId: string): DatiTabellone | null {
  const tappa = getDemoTappaGestione(tappaId);
  if (!tappa || tappa.row.stato === "bozza") return null;
  const nomi = new Map<string, string>();
  const note = new Map<string, string>();
  const gironi: GironeDati[] = [];
  const tabelloni = CATEGORIE.map((categoria) => {
    const board = getDemoFaseTabellone(tappaId, categoria);
    const faseGioco = board?.faseGioco ?? null;
    // Before the start the drawn groups have no matches yet.
    const elenco =
      faseGioco === null
        ? (board?.gironi ?? [])
        : getDemoGironiGiocati(tappaId, categoria);
    for (const g of elenco) {
      for (const p of g.giocatori) {
        nomi.set(p.iscrizioneId, `${p.nome} ${p.cognome}`.trim());
      }
      gironi.push({
        id: g.id,
        nome: g.nome,
        fase: g.fase ?? "iniziale",
        categoria,
        giocatori: g.giocatori.map((p) => p.iscrizioneId),
        classifica: faseGioco === null ? null : classificaDemo(tappaId, g.id),
      });
    }
    for (const [id, nota] of noteAssenze(getDemoAssenze(tappaId, categoria))) {
      note.set(id, nota);
    }
    return {
      categoria,
      faseGioco,
      conclusoIl: getDemoConclusoIl(tappaId, categoria),
    };
  });
  return {
    tappa: { id: tappa.row.id, nome: tappa.row.nome, stato: tappa.row.stato },
    tabelloni,
    gironi,
    nomi,
    note,
  };
}

/** The demo player: the men's seat 1 («Luca Rossi»), when in a group. */
export function demoMeTabellone(dati: DatiTabellone): string | null {
  const id = `${dati.tappa.id}-M-i1`;
  return dati.gironi.some((g) => g.giocatori.includes(id)) ? id : null;
}
