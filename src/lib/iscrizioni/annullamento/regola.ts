/**
 * Until when a player can cancel their own registration (R-20, Q-09).
 * Mirror of `public.regola_annullamento()` and
 * `public.scadenza_annullamento()`: change both together (a PGlite test
 * compares them). The database repeats every check in
 * `annulla_iscrizione()`; this only decides what the screen offers.
 */
import type { StatoIscrizione, StatoTappa } from "@/lib/db/types";
import { formatScadenza } from "@/lib/tappe/format";
import { romeStartOfDay } from "@/lib/time/rome-local";

/**
 * What applies when a stage has neither a cancel deadline nor a
 * registration deadline. `inizio_tappa`: until the first day starts
 * (midnight, Europe/Rome). `nessuno`: never. Client decision: `inizio_tappa`.
 */
export type RipiegoAnnullamento = "inizio_tappa" | "nessuno";

export type RegolaAnnullamento = { ripiego: RipiegoAnnullamento };

export const REGOLA_ANNULLAMENTO: RegolaAnnullamento = {
  ripiego: "inizio_tappa",
};

/** The stage fields the rule reads. */
export type TappaAnnullabile = {
  stato: StatoTappa;
  data_inizio: string;
  iscrizioni_chiudono_il: string | null;
  annullabile_fino_al: string | null;
};

/**
 * The first instant the player can NO LONGER cancel, as ISO, or null when
 * they never can. `annullabile_fino_al`, else the registration deadline,
 * else the rule's fallback.
 */
export function scadenzaAnnullamento(
  tappa: Omit<TappaAnnullabile, "stato">,
  regola: RegolaAnnullamento = REGOLA_ANNULLAMENTO,
): string | null {
  const esplicita = tappa.annullabile_fino_al ?? tappa.iscrizioni_chiudono_il;
  if (esplicita) return new Date(esplicita).toISOString();
  if (regola.ripiego === "inizio_tappa") {
    return romeStartOfDay(tappa.data_inizio)?.toISOString() ?? null;
  }
  return null;
}

/** Why «Annulla l'iscrizione» is not offered, most important first. */
export type MotivoNonAnnullabile =
  | "non_attiva"
  | "tappa_annullata"
  | "tappa_iniziata"
  | "scadenza_superata"
  | "in_girone";

export type Annullabilita =
  | { possibile: true; scadenza: string | null }
  | {
      possibile: false;
      motivo: MotivoNonAnnullabile;
      scadenza: string | null;
    };

const STATI_ANNULLABILI: readonly StatoTappa[] = [
  "iscrizioni_aperte",
  "iscrizioni_chiuse",
];

/**
 * Whether the player can cancel now. `at` is always the server clock
 * (`now()` from `@/lib/time/server-time`): the cancel is possible while
 * `at` is strictly before the deadline, as in the database.
 */
export function puoAnnullare(
  {
    stato,
    inGirone,
    tappa,
  }: {
    stato: StatoIscrizione;
    inGirone: boolean;
    tappa: TappaAnnullabile;
  },
  at: Date,
  regola: RegolaAnnullamento = REGOLA_ANNULLAMENTO,
): Annullabilita {
  const scadenza = scadenzaAnnullamento(tappa, regola);
  const no = (motivo: MotivoNonAnnullabile): Annullabilita => ({
    possibile: false,
    motivo,
    scadenza,
  });
  if (stato !== "in_attesa" && stato !== "confermata") return no("non_attiva");
  if (tappa.stato === "annullata") return no("tappa_annullata");
  if (!STATI_ANNULLABILI.includes(tappa.stato)) return no("tappa_iniziata");
  if (scadenza === null || at.getTime() >= new Date(scadenza).getTime())
    return no("scadenza_superata");
  if (inGirone) return no("in_girone");
  return { possibile: true, scadenza };
}

/**
 * Why the action is missing, in words (shown in its place). Null when no
 * explanation is due: a registration already cancelled or refused says so
 * in its own state.
 */
export function testoNonAnnullabile(
  motivo: MotivoNonAnnullabile,
  scadenza: string | null,
): string | null {
  switch (motivo) {
    case "non_attiva":
      return null;
    case "tappa_annullata":
      return "La tappa è stata annullata: non c'è niente da annullare.";
    case "tappa_iniziata":
      return "La tappa è iniziata: l'iscrizione non si può più annullare.";
    case "scadenza_superata":
      return scadenza
        ? `Non puoi più annullare: la scadenza era il ${formatScadenza(scadenza)}. Se non puoi partecipare, avvisa l'organizzazione.`
        : "Questa tappa non prevede l'annullamento: se non puoi partecipare, avvisa l'organizzazione.";
    case "in_girone":
      return "Sei già in un girone: per ritirarti avvisa l'organizzazione.";
  }
}

/** What happens on cancel, listed in the dialog (w-annulla-iscrizione). */
export function conseguenzeAnnullamento({
  posto,
  tabellone,
}: {
  posto: number | null;
  /** «nel maschile», «nel femminile». */
  tabellone: string;
}): string[] {
  return [
    posto
      ? `Il posto ${posto} ${tabellone} torna libero per un altro giocatore.`
      : `Il tuo posto ${tabellone} torna libero per un altro giocatore.`,
    "Se cambi idea potrai iscriverti di nuovo solo finché le iscrizioni sono aperte e ci sono posti: il numero del posto può cambiare.",
    "Non giocherai questa tappa e non prenderai punti per la classifica.",
  ];
}
