import {
  dividiIscrizioni,
  riepilogoStagione,
  toIscrizioneMia,
  type IscrizioneMiaRow,
  type MieIscrizioniView,
} from "@/lib/iscrizioni/mie/mie";
import type { RigaGenerale } from "@/lib/classifica-generale/types";

/** The server clock of every fixture. */
export const AT = new Date("2027-06-01T10:00:00Z");

function tappa(
  over: Partial<IscrizioneMiaRow["tappa"]> & { id: string; nome: string },
): IscrizioneMiaRow["tappa"] {
  return {
    luogo: "Spiaggia",
    data_inizio: "2027-06-26",
    data_fine: "2027-06-27",
    stato: "iscrizioni_aperte",
    stagione: 2027,
    iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
    annullabile_fino_al: null,
    ...over,
  };
}

const RIMINI: IscrizioneMiaRow = {
  id: "00000000-0000-4000-8000-000000000001",
  stato: "in_attesa",
  posto: 12,
  categoria: "M",
  inGirone: false,
  tappa: tappa({
    id: "rimini",
    nome: "Tappa 2 · Rimini",
    luogo: "Rimini, Bagno 26",
    annullabile_fino_al: "2027-06-21T21:59:00Z",
  }),
};

const CAGLIARI_SCADUTA: IscrizioneMiaRow = {
  id: "00000000-0000-4000-8000-000000000002",
  stato: "confermata",
  posto: 7,
  categoria: "M",
  inGirone: false,
  tappa: tappa({
    id: "cagliari",
    nome: "Tappa 3 · Cagliari",
    luogo: "Cagliari, Poetto",
    data_inizio: "2027-06-05",
    data_fine: "2027-06-06",
    stato: "iscrizioni_chiuse",
    iscrizioni_chiudono_il: "2027-05-29T21:59:00Z",
  }),
};

const PESCARA_ANNULLATA: IscrizioneMiaRow = {
  id: "00000000-0000-4000-8000-000000000003",
  stato: "ritirata",
  posto: 4,
  categoria: "M",
  inGirone: false,
  tappa: tappa({
    id: "pescara",
    nome: "Tappa 4 · Pescara, Lungomare Matteotti e spiaggia libera",
    luogo: "Pescara, Lungomare Matteotti",
    data_inizio: "2027-07-26",
    data_fine: "2027-07-27",
  }),
};

const JESOLO_GIOCATA: IscrizioneMiaRow = {
  id: "00000000-0000-4000-8000-000000000004",
  stato: "confermata",
  posto: 3,
  categoria: "M",
  inGirone: true,
  tappa: tappa({
    id: "jesolo",
    nome: "Tappa 1 · Jesolo",
    luogo: "Jesolo Lido, Piazza Mazzini",
    data_inizio: "2027-05-15",
    data_fine: "2027-05-16",
    stato: "conclusa",
  }),
};

const LIGNANO_FUORI: IscrizioneMiaRow = {
  id: "00000000-0000-4000-8000-000000000005",
  stato: "confermata",
  posto: 15,
  categoria: "M",
  inGirone: true,
  tappa: tappa({
    id: "lignano",
    nome: "Tappa 0 · Lignano",
    luogo: "Lignano Sabbiadoro",
    data_inizio: "2027-05-01",
    data_fine: "2027-05-02",
    stato: "conclusa",
  }),
};

const RIGHE: RigaGenerale[] = [
  {
    utenteId: "altro",
    nome: "Marco Bianchi",
    posizione: 1,
    punti: 20,
    tappeGiocate: 2,
    puntiProvvisori: false,
    pariMerito: false,
    anonimo: false,
    tappe: [],
  },
  {
    utenteId: "me",
    nome: "Luca Rossi",
    posizione: 2,
    punti: 12,
    tappeGiocate: 2,
    puntiProvvisori: true,
    pariMerito: false,
    anonimo: false,
    tappe: [],
  },
];

export const STATI_ELENCO = [
  "completo",
  "soloProssime",
  "vuoto",
  "dopoScadenza",
  "senzaStagione",
] as const;

export type StatoElenco = (typeof STATI_ELENCO)[number];

/** w-mie-iscrizioni in one of its states. */
export function elenco(stato: StatoElenco): MieIscrizioniView {
  const mia = (row: IscrizioneMiaRow, at = AT) =>
    toIscrizioneMia(
      row,
      row === JESOLO_GIOCATA
        ? { posizione: 2, punti: 8, provvisori: true }
        : row === LIGNANO_FUORI
          ? { posizione: null, punti: 0, provvisori: false }
          : null,
      at,
    );
  const stagione = riepilogoStagione(
    { stagione: 2027, categoria: "M", righe: RIGHE },
    "me",
  );
  switch (stato) {
    case "completo":
      return {
        ...dividiIscrizioni(
          [
            RIMINI,
            CAGLIARI_SCADUTA,
            PESCARA_ANNULLATA,
            JESOLO_GIOCATA,
            LIGNANO_FUORI,
          ].map((r) => mia(r)),
        ),
        stagione,
      };
    case "soloProssime":
      return {
        ...dividiIscrizioni([mia(RIMINI)]),
        stagione: { ...stagione, punti: 0, tappeGiocate: 0, posizione: null },
      };
    case "vuoto":
      return { prossime: [], passate: [], stagione: null };
    case "dopoScadenza":
      return {
        ...dividiIscrizioni([mia(RIMINI, new Date("2027-06-22T08:00:00Z"))]),
        stagione,
      };
    case "senzaStagione":
      return { ...dividiIscrizioni([mia(RIMINI)]), stagione: null };
  }
}

/** The cancel view of the first upcoming registration (Rimini). */
export function annullamentoRimini() {
  const view = elenco("completo").prossime.find((i) => i.tappaId === "rimini");
  if (!view?.annullamento) throw new Error("fixture");
  return view.annullamento;
}
