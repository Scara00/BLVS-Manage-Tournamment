import {
  CATEGORIE,
  type StatoIscrizione,
  type StatoTappa,
} from "@/lib/db/types";
import { CATEGORIA_TABELLONE } from "@/lib/tappe/gestione-format";
import { formatPeriodoTappa } from "@/lib/tappe/format";
import { getServerTimeParts } from "@/lib/time/server-time";
import { ISCRITTI_MESSAGES } from "./messages";
import type {
  IscrittiTabelloneView,
  IscrittiTappaView,
  IscrittoRow,
  IscrittoView,
  TabelloneIscrittiRow,
  TappaIscrittiRow,
} from "./types";

export const STATO_ISCRIZIONE_LABEL: Record<StatoIscrizione, string> = {
  in_attesa: "In attesa",
  confermata: "Confermata",
  rifiutata: "Rifiutata",
  ritirata: "Ritirata",
};

/** States in which the admin may add and remove registrants. */
export const STATI_ISCRITTI_MODIFICABILI: readonly StatoTappa[] = [
  "bozza",
  "iscrizioni_aperte",
  "iscrizioni_chiuse",
];

/** Mirrors `public.tappa_iscritti_modificabili()`. */
export function iscrittiModificabili(stato: StatoTappa): boolean {
  return STATI_ISCRITTI_MODIFICABILI.includes(stato);
}

function notaSolaLettura(stato: StatoTappa): string | null {
  if (iscrittiModificabili(stato)) return null;
  if (stato === "annullata") return ISCRITTI_MESSAGES.annullata;
  if (stato === "archiviata") return ISCRITTI_MESSAGES.archiviata;
  return ISCRITTI_MESSAGES.nonModificabile;
}

/**
 * Free seats as words, in capitals like the scoreboard: «5 POSTI LIBERI»,
 * «1 POSTO LIBERO», «NESSUN POSTO LIBERO». Past the maximum (only possible
 * through the backend) it says by how many.
 */
export function postiLiberiTesto(posti: number, occupati: number): string {
  const liberi = posti - occupati;
  if (liberi < 0) {
    const oltre = -liberi;
    return oltre === 1 ? "1 OLTRE IL MASSIMO" : `${oltre} OLTRE IL MASSIMO`;
  }
  if (liberi === 0) return "NESSUN POSTO LIBERO";
  return liberi === 1 ? "1 POSTO LIBERO" : `${liberi} POSTI LIBERI`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** «12/05/2027 14:30» in Europe/Rome: digits only, for the mono column. */
export function formatIscrittoIl(iso: string): string {
  const p = getServerTimeParts(new Date(iso));
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function nomeCompleto(row: { nome: string; cognome: string }): string {
  return `${row.cognome} ${row.nome}`.trim();
}

/** Seat first (no seat last), then registration time. */
function perPosto(a: IscrittoRow, b: IscrittoRow): number {
  const pa = a.posto ?? Number.POSITIVE_INFINITY;
  const pb = b.posto ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return a.created_at.localeCompare(b.created_at);
}

function toIscrittoView(row: IscrittoRow): IscrittoView {
  return {
    id: row.id,
    posto: row.posto,
    nome: nomeCompleto(row),
    email: row.email,
    iscrittoIl: row.created_at,
    iscrittoIlTesto: formatIscrittoIl(row.created_at),
    stato: row.stato,
    statoLabel: STATO_ISCRIZIONE_LABEL[row.stato],
  };
}

const ATTIVI: readonly StatoIscrizione[] = ["in_attesa", "confermata"];

/** Active registrations of one board, by seat, with the free seats. */
export function toTabelloneView(
  tabellone: TabelloneIscrittiRow,
  rows: readonly IscrittoRow[],
): IscrittiTabelloneView {
  const iscritti = rows
    .filter((r) => r.categoria === tabellone.categoria)
    .filter((r) => ATTIVI.includes(r.stato))
    .sort(perPosto)
    .map(toIscrittoView);
  const occupati = iscritti.length;
  return {
    categoria: tabellone.categoria,
    label: CATEGORIA_TABELLONE[tabellone.categoria],
    posti: tabellone.posti,
    occupati,
    liberi: Math.max(0, tabellone.posti - occupati),
    liberiTesto: postiLiberiTesto(tabellone.posti, occupati),
    pieno: occupati >= tabellone.posti,
    iscritti,
  };
}

/** w-admin-iscritti: the stage and its two boards, M first. */
export function toIscrittiTappaView(
  tappa: TappaIscrittiRow,
  tabelloni: readonly TabelloneIscrittiRow[],
  rows: readonly IscrittoRow[],
): IscrittiTappaView {
  const ordinati = [...tabelloni].sort(
    (a, b) => CATEGORIE.indexOf(a.categoria) - CATEGORIE.indexOf(b.categoria),
  );
  return {
    id: tappa.id,
    nome: tappa.nome,
    periodo: formatPeriodoTappa(tappa.data_inizio, tappa.data_fine),
    stato: tappa.stato,
    modificabile: iscrittiModificabili(tappa.stato),
    notaSolaLettura: notaSolaLettura(tappa.stato),
    tabelloni: ordinati.map((t) => toTabelloneView(t, rows)),
  };
}

/** «Nessun giocatore trovato», «1 giocatore trovato», «N giocatori trovati». */
export function risultatiTesto(n: number): string {
  if (n === 0) return "Nessun giocatore trovato.";
  return n === 1 ? "1 giocatore trovato." : `${n} giocatori trovati.`;
}
