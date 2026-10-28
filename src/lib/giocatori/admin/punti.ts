/**
 * «Punti spostati» (BLVS-54): the overall standing follows the player's
 * current category, so a change moves every season's points from one
 * standing to the other. Pure: it works on the rows of
 * `classifica_generale_dati`, the same ones w-classifica reads.
 */
import {
  classificaDaDati,
  type DatiClassificaGenerale,
  type DatiTabellone,
} from "@/lib/classifica-generale/dati";
import type { Categoria } from "@/lib/db/types";
import type { PuntiStagione, SpostamentoStagione } from "./types";

const VUOTO: DatiTabellone = {
  tappe: [],
  gironi: [],
  membri: [],
  partite: [],
  decisioni: [],
  iscrizioni: [],
};

/** The rows of one season only (both boards). */
export function datiDellaStagione(
  dati: DatiClassificaGenerale,
  stagione: number,
): DatiClassificaGenerale {
  const filtra = (d: DatiTabellone): DatiTabellone => {
    const tappe = d.tappe.filter((t) => t.stagione === stagione);
    const ids = new Set(tappe.map((t) => t.id));
    const gironi = d.gironi.filter((g) => ids.has(g.tappa_id));
    const idGironi = new Set(gironi.map((g) => g.id));
    return {
      tappe,
      gironi,
      membri: d.membri.filter((m) => idGironi.has(m.girone_id)),
      partite: d.partite.filter(
        (p) => p.girone_id !== null && idGironi.has(p.girone_id),
      ),
      decisioni: d.decisioni.filter((x) => idGironi.has(x.girone_id)),
      iscrizioni: d.iscrizioni.filter((i) => ids.has(i.tappa_id)),
    };
  };
  return { ...filtra(dati), altro: filtra(dati.altro ?? VUOTO) };
}

/** The same rows seen from the other category (`altro` becomes the board). */
export function datiDellAltra(
  dati: DatiClassificaGenerale,
): DatiClassificaGenerale {
  const { altro, ...questo } = dati;
  return { ...(altro ?? VUOTO), altro: questo };
}

/** The rows as they would be once `utenteId` plays in `categoria`. */
export function conCategoria(
  dati: DatiClassificaGenerale,
  utenteId: string,
  categoria: Categoria,
): DatiClassificaGenerale {
  const cambia = (d: DatiTabellone): DatiTabellone => ({
    ...d,
    iscrizioni: d.iscrizioni.map((i) =>
      i.utente_id === utenteId ? { ...i, categoria_attuale: categoria } : i,
    ),
  });
  return { ...cambia(dati), altro: cambia(dati.altro ?? VUOTO) };
}

/** Seasons of the stages `utenteId` played on either board, newest first. */
export function stagioniGiocate(
  dati: DatiClassificaGenerale,
  utenteId: string,
): number[] {
  const stagioni = new Set<number>();
  for (const d of [dati, dati.altro ?? VUOTO]) {
    const tappe = new Map(d.tappe.map((t) => [t.id, t.stagione]));
    for (const i of d.iscrizioni) {
      const stagione = tappe.get(i.tappa_id);
      if (i.utente_id === utenteId && stagione !== undefined) {
        stagioni.add(stagione);
      }
    }
  }
  return [...stagioni].sort((a, b) => b - a);
}

/**
 * The player's row per season in the standing of `categoria`, which must be
 * the category `dati` was read for (its current one).
 */
export function puntiPerStagione(
  dati: DatiClassificaGenerale,
  utenteId: string,
  categoria: Categoria,
): PuntiStagione[] {
  return stagioniGiocate(dati, utenteId).flatMap((stagione) => {
    const riga = classificaDaDati(
      datiDellaStagione(dati, stagione),
      categoria,
      stagione,
    ).righe.find((r) => r.utenteId === utenteId);
    return riga
      ? [
          {
            stagione,
            categoria,
            posizione: riga.posizione,
            punti: riga.punti,
            tappe: riga.tappeGiocate,
            provvisori: riga.puntiProvvisori,
          },
        ]
      : [];
  });
}

/**
 * Per season, the points `utenteId` takes from the standing of `da` (the
 * category `dati` was read for) to the standing of `a`, with the place
 * before (in `da`) and after (in `a`). Seasons with no stage played are
 * left out.
 */
export function spostamentoPunti(
  dati: DatiClassificaGenerale,
  utenteId: string,
  da: Categoria,
  a: Categoria,
): SpostamentoStagione[] {
  if (da === a) return [];
  const dopo = datiDellAltra(conCategoria(dati, utenteId, a));
  return stagioniGiocate(dati, utenteId).flatMap((stagione) => {
    const prima = classificaDaDati(
      datiDellaStagione(dati, stagione),
      da,
      stagione,
    ).righe.find((r) => r.utenteId === utenteId);
    const nuova = classificaDaDati(
      datiDellaStagione(dopo, stagione),
      a,
      stagione,
    ).righe.find((r) => r.utenteId === utenteId);
    const riga = nuova ?? prima;
    if (!riga) return [];
    return [
      {
        stagione,
        punti: riga.punti,
        tappe: riga.tappeGiocate,
        provvisori: riga.puntiProvvisori,
        posizionePrima: prima?.posizione ?? null,
        posizioneDopo: nuova?.posizione ?? null,
      },
    ];
  });
}
