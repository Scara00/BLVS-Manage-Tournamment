/**
 * «Cosa cambia» (w-admin-correzione): what a corrected score changes,
 * recomputed from the values being typed. Pure: the group standing is
 * BLVS-27's `classificaGirone`, run once with the saved score and once
 * with the new one, so the preview follows the same rules as the pages.
 */
import type { SetPunteggio } from "@/lib/db/types";
import {
  classificaGirone,
  type ClassificaGirone,
  type PartitaGirone,
} from "@/lib/gironi/classifica/classifica";
import { coppie, nomiGiocatori, setPartita } from "../format";
import type { PartitaPunteggio } from "../types";
import type { Lato, ValidazionePunteggio } from "../validazione";

export type VoceCambio = {
  /** Stable key for the list. */
  id: string;
  testo: string;
  /** An error («non chiude il set»), shown and announced as such. */
  errore?: boolean;
};

export type CosaCambia = {
  /** The new value is a valid, complete score. */
  valido: boolean;
  /** Same score as the saved one: nothing would change. */
  invariato: boolean;
  voci: VoceCambio[];
};

export const NESSUN_CAMBIO =
  "Il punteggio è uguale a quello salvato: non cambia nulla.";
export const RICALCOLO =
  "Classifiche e punti di tappa si ricalcolano da soli dopo il salvataggio; il registro conserva il valore precedente.";

function toPartitaGirone(
  p: PartitaPunteggio,
  sets: SetPunteggio[],
): PartitaGirone {
  return {
    id: p.id,
    stato: sets.length > 0 ? "conclusa" : p.stato,
    squadre: {
      A: p.squadre.a.map((g) => g.iscrizioneId),
      B: p.squadre.b.map((g) => g.iscrizioneId),
    },
    sets,
  };
}

/** The group standing with `partita` set to `sets` (the others as saved). */
export function classificaCon(
  partita: PartitaPunteggio,
  partiteGirone: readonly PartitaPunteggio[],
  sets: SetPunteggio[],
): ClassificaGirone {
  const partite = partiteGirone.some((p) => p.id === partita.id)
    ? partiteGirone
    : [...partiteGirone, partita];
  const iscrizioni = [
    ...new Set(
      partite.flatMap((p) =>
        [...p.squadre.a, ...p.squadre.b].map((g) => g.iscrizioneId),
      ),
    ),
  ].sort();
  return classificaGirone(
    iscrizioni,
    partite.map((p) =>
      p.id === partita.id
        ? toPartitaGirone(p, sets)
        : toPartitaGirone(p, p.sets),
    ),
  );
}

function posizioni(classifica: ClassificaGirone) {
  return new Map(
    classifica.righe.map((r) => [
      r.iscrizioneId,
      { posizione: r.posizione, pari: r.daRisolvere },
    ]),
  );
}

function posto({ posizione, pari }: { posizione: number; pari: boolean }) {
  return pari ? `${posizione}° a pari merito` : `${posizione}°`;
}

function vincitoreDi(set: SetPunteggio | null): Lato | null {
  if (!set || set.a === set.b) return null;
  return set.a > set.b ? "a" : "b";
}

/**
 * The lines of «Cosa cambia» for the values in the form. An invalid score
 * gives one error line (e.g. «21–20 non chiude il set: …»), so the
 * section never shows a standing the server would refuse.
 */
export function cosaCambia(
  partita: PartitaPunteggio,
  partiteGirone: readonly PartitaPunteggio[],
  controllo: Pick<
    ValidazionePunteggio,
    "punti" | "valido" | "punteggio" | "codice"
  >,
): CosaCambia {
  const vecchio = setPartita(partita.sets);
  const { a, b } = controllo.punti;
  const completo =
    a !== null && b !== null && !Number.isNaN(a) && !Number.isNaN(b);

  if (!controllo.valido) {
    if (!completo) {
      return {
        valido: false,
        invariato: false,
        voci: [
          {
            id: "mancante",
            testo:
              "Inserisci i punti di entrambe le coppie per vedere cosa cambia.",
          },
        ],
      };
    }
    const motivo = controllo.punteggio ? ` ${controllo.punteggio}` : "";
    return {
      valido: false,
      invariato: false,
      voci: [
        {
          id: "non-chiude",
          errore: true,
          testo:
            controllo.codice === "pareggio"
              ? `${a}–${b} non chiude il set: il pareggio non è ammesso.`
              : `${a}–${b} non chiude il set:${motivo}`,
        },
      ],
    };
  }

  const nuovo = { a: a as number, b: b as number };
  if (vecchio && vecchio.a === nuovo.a && vecchio.b === nuovo.b) {
    return {
      valido: true,
      invariato: true,
      voci: [{ id: "invariato", testo: NESSUN_CAMBIO }],
    };
  }

  const nomi = coppie(partita);
  const voci: VoceCambio[] = [];
  const vinceva = vincitoreDi(vecchio);
  const vince = vincitoreDi(nuovo) as Lato;
  if (!vinceva) {
    voci.push({ id: "vincitore", testo: `Vince ${nomi[vince]}.` });
  } else if (vinceva === vince) {
    voci.push({ id: "vincitore", testo: `Vince ancora ${nomi[vince]}.` });
  } else {
    voci.push({
      id: "vincitore",
      testo: `Il vincitore cambia: ora vince ${nomi[vince]}, non più ${nomi[vinceva]}.`,
    });
  }
  for (const lato of ["a", "b"] as const) {
    const prima = vecchio ? vecchio[lato] : null;
    if (prima === nuovo[lato]) continue;
    voci.push({
      id: `punti-${lato}`,
      testo: `${nomi[lato]}: ${prima ?? "—"} → ${nuovo[lato]} punti.`,
    });
  }

  const prima = posizioni(classificaCon(partita, partiteGirone, partita.sets));
  const dopoClassifica = classificaCon(partita, partiteGirone, [nuovo]);
  const dopo = posizioni(dopoClassifica);
  const nomiId = nomiGiocatori([...partiteGirone, partita]);
  const spostati = dopoClassifica.righe.filter((r) => {
    const p = prima.get(r.iscrizioneId);
    const d = dopo.get(r.iscrizioneId)!;
    return !p || p.posizione !== d.posizione || p.pari !== d.pari;
  });
  if (spostati.length === 0) {
    voci.push({
      id: "classifica",
      testo: `La classifica di ${partita.gironeNome} non cambia.`,
    });
  } else {
    for (const r of spostati) {
      const p = prima.get(r.iscrizioneId);
      const d = dopo.get(r.iscrizioneId)!;
      const nome = nomiId.get(r.iscrizioneId) ?? r.iscrizioneId;
      voci.push({
        id: `posto-${r.iscrizioneId}`,
        testo: p
          ? `${nome}: dal ${posto(p)} al ${posto(d)} posto in ${partita.gironeNome}.`
          : `${nome}: ${posto(d)} posto in ${partita.gironeNome}.`,
      });
    }
  }
  if (dopoClassifica.parita.length > 0) {
    voci.push({
      id: "parita",
      testo: "Resta o si apre una parità da risolvere nel girone.",
    });
  }
  voci.push({ id: "ricalcolo", testo: RICALCOLO });
  return { valido: true, invariato: false, voci };
}

/** One sentence for the live region, read after a typing pause. */
export function annuncioCosaCambia(cambio: CosaCambia): string {
  return `Cosa cambia: ${cambio.voci.map((v) => v.testo).join(" ")}`;
}
