import { formatPeriodoTappa } from "@/lib/tappe/format";
import type { TappaModifica } from "./types";

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const dayMonthYear = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «24 giugno 2027, 20:00» from a Rome `datetime-local` value; "—" if empty. */
export function formatScadenza(local: string): string {
  const match = LOCAL_RE.exec(local);
  if (!match) return "—";
  const [year, month, day, hour, minute] = match.slice(1);
  // Only the calendar day is formatted; the wall-clock time is the input's.
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return `${dayMonthYear.format(date)}, ${hour}:${minute}`;
}

/** The saved values the conflict panel lists, label → text. */
export function riepilogoTappa(tappa: TappaModifica): [string, string][] {
  return [
    ["Nome", tappa.nome],
    ["Luogo", tappa.luogo],
    ["Date", formatPeriodoTappa(tappa.data, tappa.dataFine)],
    ["Scadenza iscrizioni", formatScadenza(tappa.scadenza)],
    ["Massimo tabellone maschile", String(tappa.tabelloni.M.posti)],
    ["Massimo tabellone femminile", String(tappa.tabelloni.F.posti)],
  ];
}
