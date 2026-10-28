import type { StatoIscrizione, StatoTappa } from "@/lib/db/types";

/*
 * w-home (BLVS-52): which view the player's home shows today. Pure, so the
 * choice by day is unit-tested without the clock or the database.
 */

/** A stage as the home needs it to decide: state and calendar days. */
export type TappaHomeRow = {
  id: string;
  stato: StatoTappa;
  /** `YYYY-MM-DD`. */
  data_inizio: string;
  data_fine: string;
};

/** One of the player's own registrations. */
export type IscrizioneHome = {
  tappaId: string;
  stato: StatoIscrizione;
  posto: number | null;
};

export type SceltaHome =
  /** A stage of mine is being played today. */
  | { tipo: "gara"; tappaId: string; iscrizione: IscrizioneHome }
  /** The next stage: mine if I have one, else the next on the calendar. */
  | { tipo: "prossima"; tappaId: string; iscrizione: IscrizioneHome | null }
  | { tipo: "vuota" };

/** Registrations that hold a seat (the same rule as w-tappa). */
const ATTIVE: readonly StatoIscrizione[] = ["confermata", "in_attesa"];

/** Stages that are no longer, or never were, ahead of the player. */
const NON_PROSSIME: readonly StatoTappa[] = [
  "bozza",
  "annullata",
  "conclusa",
  "archiviata",
];

export function iscrizioneAttiva(
  iscrizione: IscrizioneHome | null | undefined,
): iscrizione is IscrizioneHome {
  return !!iscrizione && ATTIVE.includes(iscrizione.stato);
}

/**
 * Race day (client decision): the stage is in progress and today, in
 * Europe/Rome, falls between its first and last day (inclusive).
 */
export function giornoDiGara(tappa: TappaHomeRow, oggi: string): boolean {
  return (
    tappa.stato === "in_corso" &&
    tappa.data_inizio <= oggi &&
    oggi <= tappa.data_fine
  );
}

const perData = (a: TappaHomeRow, b: TappaHomeRow) =>
  a.data_inizio.localeCompare(b.data_inizio) || a.id.localeCompare(b.id);

/**
 * The view for `oggi` (`YYYY-MM-DD`, Rome):
 * 1. «gara» on the race day of a stage I am registered to;
 * 2. else «prossima»: the earliest upcoming stage I am registered to, or
 *    else the earliest upcoming stage at all (drafts, cancelled and
 *    finished stages never count);
 * 3. else «vuota».
 */
export function scegliVista({
  tappe,
  iscrizioni,
  oggi,
}: {
  tappe: readonly TappaHomeRow[];
  iscrizioni: readonly IscrizioneHome[];
  oggi: string;
}): SceltaHome {
  const mia = (tappaId: string) =>
    iscrizioni.find((i) => i.tappaId === tappaId && iscrizioneAttiva(i)) ??
    null;
  const ordinate = [...tappe].sort(perData);

  for (const tappa of ordinate) {
    const iscrizione = mia(tappa.id);
    if (iscrizione && giornoDiGara(tappa, oggi)) {
      return { tipo: "gara", tappaId: tappa.id, iscrizione };
    }
  }

  const prossime = ordinate.filter(
    (t) => !NON_PROSSIME.includes(t.stato) && t.data_fine >= oggi,
  );
  const mie = prossime.find((t) => mia(t.id));
  if (mie)
    return { tipo: "prossima", tappaId: mie.id, iscrizione: mia(mie.id) };
  const prima = prossime[0];
  if (prima) return { tipo: "prossima", tappaId: prima.id, iscrizione: null };
  return { tipo: "vuota" };
}

/** «Ciao, Luca», or a plain «Ciao» without a name. */
export function saluto(nome: string | null | undefined): string {
  const pulito = nome?.trim();
  return pulito ? `Ciao, ${pulito}` : "Ciao";
}

/** What the next-stage card says about my registration, as text. */
export function statoIscrizioneHome(
  iscrizione: IscrizioneHome | null,
  tappa: { stato: StatoTappa; iscrivibile: boolean },
):
  | { tipo: "iscritto"; testo: string }
  | { tipo: "aperte"; testo: string }
  | { tipo: "chiuse"; testo: string } {
  if (iscrizioneAttiva(iscrizione)) {
    const posto = iscrizione.posto ? ` · posto ${iscrizione.posto}` : "";
    return iscrizione.stato === "confermata"
      ? { tipo: "iscritto", testo: `Sei iscritto${posto}` }
      : { tipo: "iscritto", testo: `Iscrizione in attesa di conferma${posto}` };
  }
  if (tappa.iscrivibile) {
    return { tipo: "aperte", testo: "Iscrizioni aperte" };
  }
  if (tappa.stato === "iscrizioni_aperte") {
    return {
      tipo: "chiuse",
      testo: "Posti esauriti nella tua categoria",
    };
  }
  return { tipo: "chiuse", testo: "Iscrizioni chiuse" };
}

/** My place in my group's live standing, or null when I am not in it. */
export function posizioneNelGirone(
  rows: readonly { playerId?: string; position: number }[],
  me: string | null,
): { position: number; tied: boolean } | null {
  if (!me) return null;
  const mia = rows.find((r) => r.playerId === me);
  if (!mia) return null;
  return {
    position: mia.position,
    tied: rows.some((r) => r !== mia && r.position === mia.position),
  };
}
