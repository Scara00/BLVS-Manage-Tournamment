import type { Categoria } from "@/lib/db/types";
import {
  toIscrizioneConfermata,
  toTappaDettaglio,
  type DettaglioTappaRow,
  type IscrizionePropria,
  type TabelloneTappaRow,
  type TappaDettaglio,
} from "@/lib/tappe/dettaglio";

/** Fixtures for the stories and tests of w-tappa / w-iscrizione-ok. */
export const TAPPA_ROW: DettaglioTappaRow = {
  id: "rimini",
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data_inizio: "2027-06-26",
  data_fine: "2027-06-27",
  stato: "iscrizioni_aperte",
  iscrizioni_aprono_il: "2027-05-15T07:00:00Z",
  iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
  ritrovo: "Bagno 26, ingresso dal lungomare",
  ritrovo_alle: "2027-06-26T06:30:00Z",
  programma:
    "Sabato 26: accrediti 8:30, gironi dalle 9:30.\nDomenica 27: eliminazione dalle 9:00, finali alle 16:00.",
  annullabile_fino_al: "2027-06-21T21:59:00Z",
};

export const TABELLONI: TabelloneTappaRow[] = [
  { categoria: "M", posti: 16, occupati: 11, prossimo_posto: 12, fase: null },
  { categoria: "F", posti: 12, occupati: 7, prossimo_posto: 8, fase: null },
];

/** Before the deadline. */
export const AT = new Date("2027-06-01T10:00:00Z");

export const STATI_DETTAGLIO = [
  "aperta",
  "chiusa",
  "scaduta",
  "esaurita",
  "annullata",
  "giaIscritto",
  "senzaCategoria",
  "inCorso",
] as const;

export type StatoDettaglio = (typeof STATI_DETTAGLIO)[number];

const ISCRITTO: IscrizionePropria = {
  posto: 12,
  stato: "in_attesa",
  categoria: "M",
};

/** The detail view model in one of its states. */
export function dettaglio(stato: StatoDettaglio): TappaDettaglio {
  let row = TAPPA_ROW;
  let boards = TABELLONI;
  let at = AT;
  let categoria: Categoria | null = "M";
  let iscrizione: IscrizionePropria | null = null;
  switch (stato) {
    case "chiusa":
      row = { ...row, stato: "iscrizioni_chiuse" };
      break;
    case "scaduta":
      at = new Date("2027-06-20T08:00:00Z");
      break;
    case "esaurita":
      boards = [
        { ...boards[0], occupati: 16, prossimo_posto: null },
        boards[1],
      ];
      break;
    case "annullata":
      row = { ...row, stato: "annullata" };
      break;
    case "giaIscritto":
      boards = [{ ...boards[0], occupati: 12, prossimo_posto: 13 }, boards[1]];
      iscrizione = ISCRITTO;
      break;
    case "senzaCategoria":
      categoria = null;
      break;
    case "inCorso":
      row = { ...row, stato: "in_corso" };
      boards = [
        { ...boards[0], occupati: 16, fase: "eliminazione" },
        { ...boards[1], occupati: 12, fase: "gironi" },
      ];
      break;
  }
  return toTappaDettaglio(row, boards, { categoria, iscrizione, at });
}

export const CONFERMATA = toIscrizioneConfermata(TAPPA_ROW, ISCRITTO);
