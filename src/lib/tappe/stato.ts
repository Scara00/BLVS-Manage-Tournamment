import type { StatoTappa } from "@/lib/db/types";
import {
  getServerTimeParts,
  getUtcOffsetMinutes,
} from "@/lib/time/server-time";
import { STATO_TAPPA_LABEL } from "./format";

/**
 * Registration flow of a stage: bozza › iscrizioni aperte › iscrizioni
 * chiuse. Mirrors the trigger `tappe_controlla_stato` (migration
 * 20261027320000_stato_tappa.sql), which is the real guard.
 */
export const FLUSSO_ISCRIZIONI = [
  "bozza",
  "iscrizioni_aperte",
  "iscrizioni_chiuse",
] as const satisfies readonly StatoTappa[];

export type StatoFlusso = (typeof FLUSSO_ISCRIZIONI)[number];

export function isStatoFlusso(stato: StatoTappa): stato is StatoFlusso {
  return (FLUSSO_ISCRIZIONI as readonly StatoTappa[]).includes(stato);
}

/** The only changes of state the management page offers: one step forward. */
export const TRANSIZIONI_PERMESSE: Partial<
  Record<StatoTappa, readonly StatoTappa[]>
> = {
  bozza: ["iscrizioni_aperte"],
  iscrizioni_aperte: ["iscrizioni_chiuse"],
};

export function isTransizionePermessa(da: StatoTappa, a: StatoTappa): boolean {
  return TRANSIZIONI_PERMESSE[da]?.includes(a) ?? false;
}

export function prossimoStato(stato: StatoTappa): StatoTappa | null {
  return TRANSIZIONI_PERMESSE[stato]?.[0] ?? null;
}

export type TipoTransizione = "apertura" | "chiusura";

export function tipoTransizione(
  da: StatoTappa,
  a: StatoTappa,
): TipoTransizione | null {
  if (da === "bozza" && a === "iscrizioni_aperte") return "apertura";
  if (da === "iscrizioni_aperte" && a === "iscrizioni_chiuse")
    return "chiusura";
  return null;
}

export type CopyTransizione = {
  /** Trigger button on the page. */
  azione: string;
  /** Dialog title. */
  titolo: string;
  /** What the change does, in the players' terms. */
  effetto: string;
  /** Confirm button in the dialog. */
  conferma: string;
  /** Confirm button while the action runs. */
  inCorso: string;
  /** Toast after the change. */
  successo: string;
};

export const COPY_TRANSIZIONE: Record<TipoTransizione, CopyTransizione> = {
  apertura: {
    azione: "Apri le iscrizioni",
    titolo: "Aprire le iscrizioni?",
    effetto:
      "La tappa diventerà visibile ai giocatori e potranno iscriversi fino alla scadenza. Alla scadenza le iscrizioni si chiuderanno da sole.",
    conferma: "Apri le iscrizioni",
    inCorso: "Apertura…",
    successo: "Iscrizioni aperte: la tappa è visibile ai giocatori.",
  },
  chiusura: {
    azione: "Chiudi le iscrizioni",
    titolo: "Chiudere le iscrizioni adesso?",
    effetto:
      "I giocatori non potranno più iscriversi, anche se la scadenza non è ancora arrivata. Le iscrizioni già ricevute restano valide. Non si potranno riaprire.",
    conferma: "Chiudi le iscrizioni",
    inCorso: "Chiusura…",
    successo: "Iscrizioni chiuse: nessuno può più iscriversi.",
  },
};

// ---------------------------------------------------------------------------
// Dates: deadlines are instants, shown and typed in Europe/Rome.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** «19 giugno 2027 alle 23:59», in Europe/Rome. */
export function formatIstante(date: Date): string {
  const p = getServerTimeParts(date);
  return `${p.day} ${MESI[p.month - 1]} ${p.year} alle ${pad(p.hour)}:${pad(p.minute)}`;
}

/** «23:59», in Europe/Rome. */
export function formatOra(date: Date): string {
  const p = getServerTimeParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Value for `<input type="datetime-local">`: `YYYY-MM-DDTHH:mm` in Rome. */
export function toRomeLocalInput(date: Date): string {
  const p = getServerTimeParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * The instant of a Rome wall-clock time `YYYY-MM-DDTHH:mm`, or `null` when
 * the text is not a real date. Independent of the process time zone.
 */
export function fromRomeLocalInput(value: string): Date | null {
  const m = LOCAL_INPUT.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(asUtc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return null;
  }
  const first = getUtcOffsetMinutes(new Date(asUtc));
  let instant = asUtc - first * 60_000;
  const second = getUtcOffsetMinutes(new Date(instant));
  if (second !== first) instant = asUtc - second * 60_000;
  return new Date(instant);
}

function romeDayNumber(date: Date): number {
  const p = getServerTimeParts(date);
  return Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
}

/**
 * Calendar days in Europe/Rome from `at` to the deadline: 0 = today,
 * 1 = tomorrow. Negative once the deadline's day is past.
 */
export function giorniAllaChiusura(chiudonoIl: Date, at: Date): number {
  return romeDayNumber(chiudonoIl) - romeDayNumber(at);
}

/** Why registrations cannot open yet, or `null` when they can. */
export function requisitoApertura(
  chiudonoIl: Date | null,
  at: Date,
): string | null {
  if (!chiudonoIl) return "Imposta prima la scadenza delle iscrizioni.";
  if (chiudonoIl.getTime() <= at.getTime()) {
    return "La scadenza è già passata: impostane una futura prima di aprire le iscrizioni.";
  }
  return null;
}

export type VincoliScadenza = {
  /** First day of the stage, `YYYY-MM-DD`. */
  dataInizio: string;
  iscrizioniApronoIl: Date | null;
};

export type EsitoScadenza =
  { ok: true; value: Date } | { ok: false; error: string };

/** Validates a deadline typed as Rome local time (`datetime-local`). */
export function validaScadenza(
  value: string,
  { dataInizio, iscrizioniApronoIl }: VincoliScadenza,
  at: Date,
): EsitoScadenza {
  if (!value.trim()) {
    return { ok: false, error: "Inserisci data e ora della scadenza." };
  }
  const date = fromRomeLocalInput(value);
  if (!date) {
    return {
      ok: false,
      error: "Data non valida: scegli giorno, mese, anno e ora.",
    };
  }
  if (date.getTime() <= at.getTime()) {
    return { ok: false, error: "La scadenza deve essere nel futuro." };
  }
  if (iscrizioniApronoIl && date.getTime() <= iscrizioniApronoIl.getTime()) {
    return {
      ok: false,
      error: `La scadenza deve venire dopo l'apertura delle iscrizioni (${formatIstante(iscrizioniApronoIl)}).`,
    };
  }
  const inizio = fromRomeLocalInput(`${dataInizio}T00:00`);
  if (inizio && date.getTime() > inizio.getTime()) {
    return {
      ok: false,
      error: `Le iscrizioni devono chiudersi entro l'inizio della tappa (${formatIstante(inizio)}).`,
    };
  }
  return { ok: true, value: date };
}

// ---------------------------------------------------------------------------
// Before → after comparison shown in the confirmation dialog
// ---------------------------------------------------------------------------

export type RigaConfronto = { aspetto: string; ora: string; dopo: string };

function visibile(stato: StatoTappa) {
  return stato === "bozza" ? "No, è una bozza" : "Sì";
}

function nuoveIscrizioni(stato: StatoTappa, chiudonoIl: Date | null) {
  if (stato !== "iscrizioni_aperte") return "Non accettate";
  return chiudonoIl
    ? `Accettate fino al ${formatIstante(chiudonoIl)}`
    : "Accettate";
}

function chiusura(stato: StatoTappa, chiudonoIl: Date | null) {
  if (stato === "iscrizioni_chiuse") return "Già chiuse";
  if (!chiudonoIl) return "Scadenza non impostata";
  return stato === "iscrizioni_aperte"
    ? `Automatica il ${formatIstante(chiudonoIl)}`
    : `Prevista il ${formatIstante(chiudonoIl)}, dopo l'apertura`;
}

/** Rows «Aspetto: Ora → Dopo» for the change `da → a`. */
export function confrontoOraDopo(
  da: StatoTappa,
  a: StatoTappa,
  chiudonoIl: Date | null,
): RigaConfronto[] {
  return [
    {
      aspetto: "Stato",
      ora: STATO_TAPPA_LABEL[da],
      dopo: STATO_TAPPA_LABEL[a],
    },
    { aspetto: "Visibile ai giocatori", ora: visibile(da), dopo: visibile(a) },
    {
      aspetto: "Nuove iscrizioni",
      ora: nuoveIscrizioni(da, chiudonoIl),
      dopo: nuoveIscrizioni(a, chiudonoIl),
    },
    {
      aspetto: "Chiusura",
      ora: chiusura(da, chiudonoIl),
      dopo: chiusura(a, chiudonoIl),
    },
  ];
}
