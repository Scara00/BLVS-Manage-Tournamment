/**
 * Group standing (R-39) with configurable tie-breaks (R-40). Pure: the
 * standing is recomputed from the group's matches on every read, so a
 * saved, corrected or voided score is reflected without any stored total.
 * The only stored state is the admin's order for a perfect tie
 * (`spareggi_girone`), tied to the tie's `firma`.
 */
import type { StatoPartita } from "@/lib/db/types";
import {
  REGOLA_CLASSIFICA,
  type CriterioSpareggio,
  type RegolaClassifica,
} from "./criteri";

export type SetGioco = { a: number; b: number };

export type PartitaGirone = {
  id: string;
  stato: StatoPartita;
  /** Registration ids per team; teams rotate from match to match. */
  squadre: { A: readonly string[]; B: readonly string[] };
  sets: readonly SetGioco[];
};

export type StatisticheGiocatore = {
  /** Registration id (`iscrizioni.id`). */
  iscrizioneId: string;
  giocate: number;
  vinte: number;
  puntiFatti: number;
  puntiSubiti: number;
  differenza: number;
};

/** The admin's order for a perfect tie, as stored in `spareggi_girone`. */
export type DecisioneSpareggio = {
  firma: string;
  ordine: readonly string[];
};

export type RigaClassifica = StatisticheGiocatore & {
  /** 1-based; players in an open perfect tie share it. */
  posizione: number;
  /**
   * What settled this player's place among those level with them: a
   * criterion, the admin, or null while the tie is open (or when nobody
   * was ever level).
   */
  decisoDa: CriterioSpareggio | "admin" | null;
  /** Part of a perfect tie with no valid admin decision. */
  daRisolvere: boolean;
};

export type ParitaPerfetta = {
  /** Tied registrations, in the input order. */
  iscrizioni: string[];
  /** Fingerprint of the tie; a decision applies only while it matches. */
  firma: string;
  posizione: number;
};

export type StatoGirone = "in_corso" | "da_risolvere" | "completo";

export type ClassificaGirone = {
  righe: RigaClassifica[];
  /** Perfect ties still open (no decision, or one made before a change). */
  parita: ParitaPerfetta[];
  stato: StatoGirone;
};

type Esito = "A" | "B";

/**
 * The winning team of a match that counts, or null. A match counts only
 * when it is `conclusa`, has at least one set, and one team won more sets.
 */
export function vincitorePartita(partita: PartitaGirone): Esito | null {
  if (partita.stato !== "conclusa" || partita.sets.length === 0) return null;
  let a = 0;
  let b = 0;
  for (const set of partita.sets) {
    if (set.a > set.b) a++;
    else if (set.b > set.a) b++;
  }
  if (a === b) return null;
  return a > b ? "A" : "B";
}

/** Matches that enter the standing (see `vincitorePartita`). */
function partiteValide(partite: readonly PartitaGirone[]) {
  return partite.flatMap((partita) => {
    const vincitore = vincitorePartita(partita);
    return vincitore ? [{ partita, vincitore }] : [];
  });
}

/**
 * Played, won, points scored/conceded and difference per player. Points
 * of a team are credited to each of its players. Every registration in
 * `iscrizioni` gets a row, even with no match yet.
 */
export function statisticheGirone(
  iscrizioni: readonly string[],
  partite: readonly PartitaGirone[],
): StatisticheGiocatore[] {
  const stats = new Map<string, StatisticheGiocatore>(
    iscrizioni.map((id) => [
      id,
      {
        iscrizioneId: id,
        giocate: 0,
        vinte: 0,
        puntiFatti: 0,
        puntiSubiti: 0,
        differenza: 0,
      },
    ]),
  );
  for (const { partita, vincitore } of partiteValide(partite)) {
    const puntiA = partita.sets.reduce((sum, set) => sum + set.a, 0);
    const puntiB = partita.sets.reduce((sum, set) => sum + set.b, 0);
    for (const squadra of ["A", "B"] as const) {
      const fatti = squadra === "A" ? puntiA : puntiB;
      const subiti = squadra === "A" ? puntiB : puntiA;
      for (const id of partita.squadre[squadra]) {
        const riga = stats.get(id);
        if (!riga) continue;
        riga.giocate++;
        if (vincitore === squadra) riga.vinte++;
        riga.puntiFatti += fatti;
        riga.puntiSubiti += subiti;
        riga.differenza = riga.puntiFatti - riga.puntiSubiti;
      }
    }
  }
  return [...stats.values()];
}

/**
 * Deterministic fingerprint of a tie: the players and the numbers that
 * made them level. A corrected score changes it, so an old decision stops
 * applying and the tie is «da risolvere» again.
 */
export function firmaParita(gruppo: readonly StatisticheGiocatore[]): string {
  return [...gruppo]
    .sort((x, y) => (x.iscrizioneId < y.iscrizioneId ? -1 : 1))
    .map(
      (s) =>
        `${s.iscrizioneId}:${s.giocate}/${s.vinte}/${s.puntiFatti}/${s.puntiSubiti}`,
    )
    .join("|");
}

/** Registration ids inside a fingerprint. */
export function iscrizioniDellaFirma(firma: string): string[] {
  return firma.split("|").map((parte) => parte.split(":")[0]);
}

/** Wins of each tied player in the matches against another tied player. */
function vittorieScontriDiretti(
  gruppo: ReadonlySet<string>,
  partite: ReturnType<typeof partiteValide>,
): Map<string, number> {
  const vinte = new Map<string, number>([...gruppo].map((id) => [id, 0]));
  for (const { partita, vincitore } of partite) {
    const inA = partita.squadre.A.filter((id) => gruppo.has(id));
    const inB = partita.squadre.B.filter((id) => gruppo.has(id));
    if (inA.length === 0 || inB.length === 0) continue;
    for (const id of vincitore === "A" ? inA : inB) {
      vinte.set(id, (vinte.get(id) ?? 0) + 1);
    }
  }
  return vinte;
}

type Blocco = {
  giocatori: StatisticheGiocatore[];
  /** Criterion that split this block off its peers, if any. */
  decisoDa: CriterioSpareggio | null;
};

function valoreCriterio(
  criterio: CriterioSpareggio,
  gruppo: readonly StatisticheGiocatore[],
  partite: ReturnType<typeof partiteValide>,
): (s: StatisticheGiocatore) => number {
  switch (criterio) {
    case "vittorie":
      return (s) => s.vinte;
    case "differenza_punti":
      return (s) => s.differenza;
    case "punti_fatti":
      return (s) => s.puntiFatti;
    case "scontro_diretto": {
      const vinte = vittorieScontriDiretti(
        new Set(gruppo.map((s) => s.iscrizioneId)),
        partite,
      );
      return (s) => vinte.get(s.iscrizioneId) ?? 0;
    }
  }
}

/**
 * Orders `gruppo` from criterion `da` on. A block that splits starts over
 * from the first criterion, so head-to-head is recomputed among the
 * players still level (a three-way tie can reduce to a two-way one).
 */
function ordina(
  gruppo: StatisticheGiocatore[],
  criteri: readonly CriterioSpareggio[],
  partite: ReturnType<typeof partiteValide>,
  da: number,
  decisoDa: CriterioSpareggio | null,
): Blocco[] {
  if (gruppo.length === 1) return [{ giocatori: gruppo, decisoDa }];
  if (da >= criteri.length) return [{ giocatori: gruppo, decisoDa: null }];

  const criterio = criteri[da];
  const valore = valoreCriterio(criterio, gruppo, partite);
  const perValore = new Map<number, StatisticheGiocatore[]>();
  for (const s of gruppo) {
    const v = valore(s);
    perValore.set(v, [...(perValore.get(v) ?? []), s]);
  }
  if (perValore.size === 1) {
    return ordina(gruppo, criteri, partite, da + 1, decisoDa);
  }
  return [...perValore.entries()]
    .sort(([x], [y]) => y - x)
    .flatMap(([, sotto]) =>
      sotto.length === 1
        ? [{ giocatori: sotto, decisoDa: criterio }]
        : ordina(sotto, criteri, partite, 0, criterio),
    );
}

/**
 * The finished state of a group: every match is voided or counts, and at
 * least one counts.
 */
function gironeTerminato(partite: readonly PartitaGirone[]): boolean {
  let valide = 0;
  for (const partita of partite) {
    if (partita.stato === "annullata") continue;
    if (!vincitorePartita(partita)) return false;
    valide++;
  }
  return valide > 0;
}

/**
 * The standing of one group. `decisioni` are the stored admin orders; one
 * applies only to the tie with the same `firma` and the same players.
 */
export function classificaGirone(
  iscrizioni: readonly string[],
  partite: readonly PartitaGirone[],
  {
    regola = REGOLA_CLASSIFICA,
    decisioni = [],
  }: {
    regola?: RegolaClassifica;
    decisioni?: readonly DecisioneSpareggio[];
  } = {},
): ClassificaGirone {
  const stats = statisticheGirone(iscrizioni, partite);
  const blocchi = ordina(
    stats,
    regola.criteri,
    partiteValide(partite),
    0,
    null,
  );
  const perFirma = new Map(decisioni.map((d) => [d.firma, d.ordine]));

  const righe: RigaClassifica[] = [];
  const parita: ParitaPerfetta[] = [];
  for (const blocco of blocchi) {
    const posizione = righe.length + 1;
    if (blocco.giocatori.length === 1) {
      righe.push({
        ...blocco.giocatori[0],
        posizione,
        decisoDa: blocco.decisoDa,
        daRisolvere: false,
      });
      continue;
    }
    const firma = firmaParita(blocco.giocatori);
    const ordine = perFirma.get(firma);
    if (ordine && ordineValido(ordine, blocco.giocatori)) {
      const perId = new Map(blocco.giocatori.map((s) => [s.iscrizioneId, s]));
      ordine.forEach((id, i) => {
        righe.push({
          ...perId.get(id)!,
          posizione: posizione + i,
          decisoDa: "admin",
          daRisolvere: false,
        });
      });
      continue;
    }
    parita.push({
      iscrizioni: blocco.giocatori.map((s) => s.iscrizioneId),
      firma,
      posizione,
    });
    for (const s of blocco.giocatori) {
      righe.push({ ...s, posizione, decisoDa: null, daRisolvere: true });
    }
  }

  const stato: StatoGirone = !gironeTerminato(partite)
    ? "in_corso"
    : parita.length > 0
      ? "da_risolvere"
      : "completo";
  return { righe, parita, stato };
}

/** Whether `ordine` lists exactly the tied players, each once. */
export function ordineValido(
  ordine: readonly string[],
  gruppo: readonly StatisticheGiocatore[] | readonly string[],
): boolean {
  const attesi = new Set(
    gruppo.map((g) => (typeof g === "string" ? g : g.iscrizioneId)),
  );
  return (
    ordine.length === attesi.size &&
    new Set(ordine).size === ordine.length &&
    ordine.every((id) => attesi.has(id))
  );
}

/**
 * The gate for moving players on from a group: every match is in and no
 * perfect tie is left open. Advancement code must call this.
 */
export function puoAvanzare(classifica: ClassificaGirone): boolean {
  return classifica.stato === "completo";
}
