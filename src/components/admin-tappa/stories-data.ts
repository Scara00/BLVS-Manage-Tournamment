import {
  toGestioneTappaView,
  type TabelloneRow,
  type TappaGestioneRow,
} from "@/lib/tappe/gestione-format";
import {
  GESTIONE_MESSAGES,
  type CambioStatoAction,
  type ScadenzaAction,
} from "@/lib/tappe/gestione-state";

/** Fixed «now» so stories (and their axe/visual checks) never drift. */
export const ADESSO = new Date("2027-06-16T10:00:00Z");

const base: TappaGestioneRow = {
  id: "rimini",
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data_inizio: "2027-06-26",
  data_fine: "2027-06-27",
  stato: "iscrizioni_aperte",
  iscrizioni_aprono_il: "2027-05-15T07:00:00Z",
  iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
  iscrizioni_chiuse_il: null,
  chiusura_automatica: false,
};

const tabelloni: TabelloneRow[] = [
  { categoria: "M", confermate: 9, inAttesa: 3, fasiPartite: [] },
  { categoria: "F", confermate: 7, inAttesa: 2, fasiPartite: [] },
];

export function vista(
  patch: Partial<TappaGestioneRow> = {},
  boards = tabelloni,
) {
  return toGestioneTappaView({ ...base, ...patch }, boards, ADESSO);
}

export const bozza = vista({
  stato: "bozza",
  iscrizioni_aprono_il: null,
});

export const bozzaSenzaScadenza = vista({
  stato: "bozza",
  iscrizioni_aprono_il: null,
  iscrizioni_chiudono_il: null,
});

export const aperte = vista();

export const chiuseAutomaticamente = vista({
  stato: "iscrizioni_chiuse",
  iscrizioni_chiudono_il: "2027-06-12T21:59:00Z",
  iscrizioni_chiuse_il: "2027-06-12T22:00:00Z",
  chiusura_automatica: true,
});

export const testoLungo = vista(
  {
    nome: "Tappa 12 · Lido di Spina, Comacchio — Memorial «Giovanni Battista Dell'Acqua Bianchi» Gran Premio della Riviera",
    luogo:
      "Stabilimento balneare Bagno Paradiso Tropicale numero 147, Viale delle Acacie e dei Pini Marittimi, Lido di Spina (Ferrara)",
  },
  [
    {
      categoria: "M",
      confermate: 128,
      inAttesa: 47,
      fasiPartite: ["gironi", "eliminazione"],
    },
    { categoria: "F", confermate: 96, inAttesa: 12, fasiPartite: ["gironi"] },
  ],
);

const pausa = () => new Promise((resolve) => setTimeout(resolve, 600));

/** Succeeds after a short pause, like the real action. */
export const cambiaStatoFinto: CambioStatoAction = async (_prev, data) => {
  await pausa();
  return {
    status: "success",
    stato:
      data.get("a") === "iscrizioni_chiuse"
        ? "iscrizioni_chiuse"
        : "iscrizioni_aperte",
    message: "Stato aggiornato.",
    at: 1,
  };
};

export const aggiornaScadenzaFinto: ScadenzaAction = async () => {
  await pausa();
  return {
    status: "success",
    message: GESTIONE_MESSAGES.scadenzaSalvata,
    at: 1,
  };
};
