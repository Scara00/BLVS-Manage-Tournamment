/**
 * Pure logic of w-admin-parita (BLVS-38): which ties a group shows, the
 * values of each criterion, the explicit «Scambia ↕» swap, the reason and
 * the text announcing the new order.
 */
import type { Categoria } from "@/lib/db/types";
import {
  classificaGirone,
  CRITERI,
  ordineValido,
  REGOLA_CLASSIFICA,
  scontriDiretti,
  statisticheGirone,
  type CriterioSpareggio,
  type PartitaGirone,
  type RegolaClassifica,
  type StatisticheGiocatore,
} from "@/lib/gironi/classifica";
import {
  MOTIVI_PARITA,
  NOTE_PARITA_MAX,
  PARITA_MESSAGES as M,
  type CampiParita,
  type CriterioPari,
  type GiocatorePari,
  type MotivoParita,
  type ParitaGirone,
  type ParitaVista,
} from "./types";

/** A stored decision with its reason (`spareggi_girone`). */
export type DecisioneParita = {
  firma: string;
  ordine: readonly string[];
  motivo: string;
};

export type DatiParitaGirone = {
  tappaId: string;
  categoria: Categoria;
  gironeId: string;
  gironeNome: string;
  giocatori: readonly GiocatorePari[];
  partite: readonly PartitaGirone[];
  decisioni: readonly DecisioneParita[];
};

function valore(
  criterio: CriterioSpareggio,
  s: StatisticheGiocatore,
  diretti: ReadonlyMap<string, number>,
): number {
  switch (criterio) {
    case "vittorie":
      return s.vinte;
    case "scontro_diretto":
      return diretti.get(s.iscrizioneId) ?? 0;
    case "differenza_punti":
      return s.differenza;
    case "punti_fatti":
      return s.puntiFatti;
  }
}

/**
 * The perfect ties of a group, decided or not. A group still being played
 * shows none: players level before the last match are not a tie to decide
 * («parità da risolvere» is the signal of a finished group).
 */
export function paritaGirone(
  dati: DatiParitaGirone,
  regola: RegolaClassifica = REGOLA_CLASSIFICA,
): ParitaGirone {
  const { tappaId, categoria, gironeId, gironeNome } = dati;
  const vuoto = { tappaId, categoria, gironeId, gironeNome, parita: [] };
  const ids = dati.giocatori.map((g) => g.iscrizioneId);
  const base = classificaGirone(ids, dati.partite, { regola });
  if (base.stato === "in_corso" || base.parita.length === 0) return vuoto;

  const nomi = new Map(dati.giocatori.map((g) => [g.iscrizioneId, g.nome]));
  const stats = new Map(
    statisticheGirone(ids, dati.partite).map((s) => [s.iscrizioneId, s]),
  );
  const parita = base.parita.map((p): ParitaVista => {
    const decisione = dati.decisioni.find(
      (d) => d.firma === p.firma && ordineValido(d.ordine, p.iscrizioni),
    );
    const ordine = decisione ? [...decisione.ordine] : p.iscrizioni;
    const diretti = scontriDiretti(p.iscrizioni, dati.partite);
    const criteri = regola.criteri.map((id): CriterioPari => ({
      id,
      etichetta: CRITERI[id].etichetta,
      spiegazione: CRITERI[id].spiegazione,
      valori: ordine.map((iscrizioneId) => ({
        iscrizioneId,
        valore: valore(id, stats.get(iscrizioneId)!, diretti),
      })),
    }));
    return {
      firma: p.firma,
      posizione: p.posizione,
      giocatori: ordine.map((iscrizioneId) => ({
        iscrizioneId,
        nome: nomi.get(iscrizioneId) ?? iscrizioneId,
      })),
      criteri,
      decisione: decisione ? { motivo: decisione.motivo } : null,
    };
  });
  return { ...vuoto, parita };
}

/** «Da risolvere» = a finished group with at least one open tie. */
export function daRisolvere(girone: ParitaGirone): boolean {
  return girone.parita.some((p) => p.decisione === null);
}

/** «+3», «0», «−2» (a real minus sign) for point differences. */
export function formatValore(criterio: CriterioSpareggio, n: number): string {
  if (criterio !== "differenza_punti") return String(n);
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

/** Swaps place `i` and `i + 1`; any other index leaves the order as is. */
export function scambia<T>(ordine: readonly T[], i: number): T[] {
  const nuovo = [...ordine];
  if (!Number.isInteger(i) || i < 0 || i + 1 >= nuovo.length) return nuovo;
  [nuovo[i], nuovo[i + 1]] = [nuovo[i + 1], nuovo[i]];
  return nuovo;
}

/** Whether two orders differ. */
export function ordineCambiato(
  prima: readonly string[],
  dopo: readonly string[],
): boolean {
  return prima.length !== dopo.length || prima.some((id, i) => id !== dopo[i]);
}

export function ordinale(n: number): string {
  return `${n}º`;
}

/** «2º Marco Bianchi, 3º Luca Rossi». */
export function descriviOrdine(
  posizione: number,
  nomi: readonly string[],
): string {
  return nomi.map((nome, i) => `${ordinale(posizione + i)} ${nome}`).join(", ");
}

/** Said after a swap: «Ordine: 2º Marco Bianchi, 3º Luca Rossi.» */
export function annuncioScambio(
  posizione: number,
  nomi: readonly string[],
): string {
  return `Ordine: ${descriviOrdine(posizione, nomi)}.`;
}

/** Said once the decision is saved. */
export function annuncioOrdine(
  gironeNome: string,
  posizione: number,
  nomi: readonly string[],
): string {
  return `${gironeNome}: ordine deciso. ${descriviOrdine(posizione, nomi)}.`;
}

/** «Parità per il 2º posto» or «Parità dal 2º al 4º posto». */
export function titoloParita(posizione: number, giocatori: number): string {
  const ultimo = posizione + giocatori - 1;
  return giocatori === 2
    ? `Parità per il ${ordinale(posizione)} posto`
    : `Parità dal ${ordinale(posizione)} al ${ordinale(ultimo)} posto`;
}

export function isMotivoParita(value: unknown): value is MotivoParita {
  return MOTIVI_PARITA.some((m) => m.id === value);
}

/** The preset a stored reason starts with, for a decision made again. */
export function motivoDaTesto(testo: string): {
  motivo: MotivoParita;
  note: string;
} {
  for (const m of MOTIVI_PARITA) {
    if (m.id === "altro") continue;
    if (testo === m.etichetta) return { motivo: m.id, note: "" };
    if (testo.startsWith(`${m.etichetta}: `)) {
      return { motivo: m.id, note: testo.slice(m.etichetta.length + 2) };
    }
  }
  return { motivo: "altro", note: testo };
}

/** Field errors of the reason, or null when it can be saved. */
export function erroriMotivo(
  motivo: string | null,
  note: string,
): CampiParita | null {
  if (!isMotivoParita(motivo)) return { motivo: M.motivoMancante };
  const testo = note.trim();
  if (motivo === "altro" && !testo) return { note: M.noteMancanti };
  if (testo.length > NOTE_PARITA_MAX) return { note: M.noteLunghe };
  return null;
}

/**
 * The reason stored in `spareggi_girone.motivo` and in the registro note:
 * the preset, then the free text («Sorteggio: monetina al campo 2»), or the
 * free text alone for «Altro».
 */
export function componiMotivo(motivo: MotivoParita, note: string): string {
  const testo = note.trim().replace(/\s+/g, " ");
  if (motivo === "altro") return testo;
  const { etichetta } = MOTIVI_PARITA.find((m) => m.id === motivo)!;
  return testo ? `${etichetta}: ${testo}` : etichetta;
}

export type RichiestaParita = {
  tappaId: string;
  categoria: Categoria;
  gironeId: string;
  firma: string;
  ordine: string[];
  motivo: string | null;
  note: string;
};

/** The dialog's FormData; null when a field is missing or malformed. */
export function leggiRichiestaParita(
  formData: FormData,
): RichiestaParita | null {
  const testo = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : null;
  };
  const tappaId = testo("tappaId");
  const categoria = testo("categoria");
  const gironeId = testo("gironeId");
  const firma = testo("firma");
  const ordine = formData
    .getAll("ordine")
    .filter((v): v is string => typeof v === "string" && v !== "");
  if (!tappaId || !gironeId || !firma) return null;
  if (categoria !== "M" && categoria !== "F") return null;
  if (ordine.length < 2) return null;
  return {
    tappaId,
    categoria,
    gironeId,
    firma,
    ordine,
    motivo: testo("motivo"),
    note: testo("note") ?? "",
  };
}
