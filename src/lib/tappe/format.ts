import type { DemoStage } from "@/lib/demo/tournament";
import type { StatoTappa, Tappa } from "@/lib/db/types";

/** A stage as the calendar shows it. */
export type TappaCard = {
  id: string;
  name: string;
  place: string;
  date: string;
  stato: StatoTappa;
};

export type TappaRow = Pick<
  Tappa,
  "id" | "nome" | "luogo" | "data_inizio" | "data_fine" | "stato"
>;

export const STATO_TAPPA_LABEL: Record<StatoTappa, string> = {
  bozza: "In bozza",
  iscrizioni_aperte: "Iscrizioni aperte",
  iscrizioni_chiuse: "Iscrizioni chiuse",
  in_corso: "In corso",
  conclusa: "Conclusa",
  annullata: "Annullata",
};

const DEMO_STATO: Record<DemoStage["status"], StatoTappa> = {
  "Iscrizioni aperte": "iscrizioni_aperte",
  "Iscrizioni chiuse": "iscrizioni_chiuse",
  "In corso": "in_corso",
};

// `date` columns are calendar days: format them in UTC so no zone shifts them.
const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  timeZone: "UTC",
});
const dayMonth = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayMonthYear = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseDay(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

/**
 * «14–15 giugno», «30 giugno – 1 luglio», «31 dicembre 2026 – 1 gennaio 2027».
 * Inputs are `YYYY-MM-DD` dates.
 */
export function formatPeriodoTappa(inizio: string, fine: string): string {
  const start = parseDay(inizio);
  const end = parseDay(fine);
  if (inizio === fine) return dayMonth.format(start);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${dayMonthYear.format(start)} – ${dayMonthYear.format(end)}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
  }
  return `${day.format(start)}–${dayMonth.format(end)}`;
}

export function toTappaCard(row: TappaRow): TappaCard {
  return {
    id: row.id,
    name: row.nome,
    place: row.luogo,
    date: formatPeriodoTappa(row.data_inizio, row.data_fine),
    stato: row.stato,
  };
}

export function demoTappaCard(stage: DemoStage): TappaCard {
  return {
    id: stage.id,
    name: stage.name,
    place: stage.place,
    date: stage.date,
    stato: DEMO_STATO[stage.status],
  };
}
