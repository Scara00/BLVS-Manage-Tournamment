import { demoStages } from "@/lib/demo/tournament";
import type { StatoTappa } from "@/lib/db/types";
import type { TabelloneModifica, TappaModifica } from "./types";

type DemoDettaglio = {
  data: string;
  dataFine: string;
  scadenza: string;
  stato: StatoTappa;
  M: TabelloneModifica;
  F: TabelloneModifica;
};

/** Dates, deadlines and boards of the demo stages (no Supabase env). */
const DETTAGLI: Record<string, DemoDettaglio> = {
  jesolo: {
    data: "2027-06-14",
    dataFine: "2027-06-15",
    scadenza: "2027-06-10T20:00",
    stato: "in_corso",
    M: { posti: 16, iscritti: 16 },
    F: { posti: 16, iscritti: 12 },
  },
  rimini: {
    data: "2027-06-28",
    dataFine: "2027-06-29",
    scadenza: "2027-06-24T20:00",
    stato: "iscrizioni_aperte",
    M: { posti: 16, iscritti: 12 },
    F: { posti: 18, iscritti: 9 },
  },
  cagliari: {
    data: "2027-07-12",
    dataFine: "2027-07-13",
    scadenza: "2027-07-08T20:00",
    stato: "iscrizioni_chiuse",
    M: { posti: 32, iscritti: 28 },
    F: { posti: 16, iscritti: 16 },
  },
};

/** Ids of the demo stages that have an edit page. */
export const DEMO_TAPPE_MODIFICA = demoStages
  .map((stage) => stage.id)
  .filter((id) => id in DETTAGLI);

export function demoTappaModifica(id: string): TappaModifica | null {
  const stage = demoStages.find((s) => s.id === id);
  const dettaglio = DETTAGLI[id];
  if (!stage || !dettaglio) return null;
  return {
    id,
    nome: stage.name,
    luogo: stage.place,
    data: dettaglio.data,
    dataFine: dettaglio.dataFine,
    scadenza: dettaglio.scadenza,
    stato: dettaglio.stato,
    versione: 1,
    tabelloni: { M: dettaglio.M, F: dettaglio.F },
  };
}
