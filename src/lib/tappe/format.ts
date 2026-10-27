import type { DemoStage } from "@/lib/demo/tournament";
import type { Categoria, FasePartita, StatoTappa, Tappa } from "@/lib/db/types";
import { SERVER_LOCALE, SERVER_TIME_ZONE } from "@/lib/time/server-time";

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

// ---------------------------------------------------------------------------
// Player list (w-tappe): seats in the player's category, deadline, phase
// ---------------------------------------------------------------------------

/** A row of `public.tappe` as the player list reads it. */
export type TappaGiocatoreRow = TappaRow &
  Pick<Tappa, "iscrizioni_chiudono_il">;

/** A row of RPC `public.posti_tappe()`: one board of a non-draft stage. */
export type PostiRow = {
  tappa_id: string;
  categoria: Categoria;
  posti: number;
  occupati: number;
  fase: FasePartita | null;
};

export type Posti = { liberi: number; totali: number };

/** A stage as the player list shows it. */
export type TappaGiocatore = TappaCard & {
  /** «19 giugno, 23:59» (Europe/Rome), or null when no deadline is set. */
  scadenza: string | null;
  scadenzaIso: string | null;
  /** Seats in the player's category; null without a category or when cancelled. */
  posti: Posti | null;
  /** Most advanced match phase, only while the stage is in progress. */
  fase: FasePartita | null;
  /** Open for registration with seats left in the player's category. */
  iscrivibile: boolean;
};

export const FASE_LABEL: Record<FasePartita, string> = {
  gironi: "Gironi",
  eliminazione: "Eliminazione",
  finale: "Finale",
};

const FASE_ORDINE: Record<FasePartita, number> = {
  gironi: 1,
  eliminazione: 2,
  finale: 3,
};

const deadline = new Intl.DateTimeFormat(SERVER_LOCALE, {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SERVER_TIME_ZONE,
});

/** «19 giugno, 23:59», in Italian time whatever the host zone. */
export function formatScadenza(iso: string): string {
  return deadline.format(new Date(iso));
}

/**
 * Drafts never reach players. RLS already hides them, but the demo data and
 * an admin session can still see them, so the list filters them again.
 */
export function escludiBozze<Row extends { stato: StatoTappa }>(
  rows: readonly Row[],
): Row[] {
  return rows.filter((row) => row.stato !== "bozza");
}

/** «N liberi su M» for one category of one stage; null when unknown. */
export function postiPerCategoria(
  posti: readonly PostiRow[],
  tappaId: string,
  categoria: Categoria | null,
): Posti | null {
  if (!categoria) return null;
  const row = posti.find(
    (p) => p.tappa_id === tappaId && p.categoria === categoria,
  );
  if (!row) return null;
  return {
    liberi: Math.max(0, row.posti - row.occupati),
    totali: row.posti,
  };
}

/**
 * The phase of the player's board, or, without a category, the most
 * advanced one across both boards.
 */
export function faseTappa(
  posti: readonly PostiRow[],
  tappaId: string,
  categoria: Categoria | null,
): FasePartita | null {
  const boards = posti.filter((p) => p.tappa_id === tappaId && p.fase);
  const own = categoria && boards.find((p) => p.categoria === categoria);
  if (own) return own.fase;
  return boards.reduce<FasePartita | null>(
    (best, p) =>
      p.fase && (!best || FASE_ORDINE[p.fase] > FASE_ORDINE[best])
        ? p.fase
        : best,
    null,
  );
}

export function descriviPosti({ liberi, totali }: Posti): string {
  return `${liberi} ${liberi === 1 ? "libero" : "liberi"} su ${totali}`;
}

export function toTappeGiocatore(
  rows: readonly TappaGiocatoreRow[],
  posti: readonly PostiRow[],
  categoria: Categoria | null,
): TappaGiocatore[] {
  return escludiBozze(rows).map((row) => {
    const annullata = row.stato === "annullata";
    const seats = annullata
      ? null
      : postiPerCategoria(posti, row.id, categoria);
    return {
      ...toTappaCard(row),
      scadenza: row.iscrizioni_chiudono_il
        ? formatScadenza(row.iscrizioni_chiudono_il)
        : null,
      scadenzaIso: row.iscrizioni_chiudono_il,
      posti: seats,
      fase:
        row.stato === "in_corso" ? faseTappa(posti, row.id, categoria) : null,
      iscrivibile:
        row.stato === "iscrizioni_aperte" && seats !== null && seats.liberi > 0,
    };
  });
}

/** The stage being played now, for the live strip at the top of the list. */
export function tappaInCorso(
  tappe: readonly TappaGiocatore[],
): TappaGiocatore | null {
  return tappe.find((t) => t.stato === "in_corso") ?? null;
}
