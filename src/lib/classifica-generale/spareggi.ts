/**
 * Tie-breaks of the overall standing (R-47, Q-06). Each criterion carries
 * the sentence the rules page shows. The order is a client decision:
 * change it in `REGOLA_GENERALE` only.
 */
import type { TotaleGiocatore } from "./somma";
import type { RigaGenerale } from "./types";

export const CRITERI_GENERALE = [
  "punti",
  "piazzamenti",
  "ultima_tappa",
  "meno_tappe",
] as const;

export type CriterioGenerale = (typeof CRITERI_GENERALE)[number];

export const CRITERI_GENERALE_TESTO: Readonly<
  Record<CriterioGenerale, { etichetta: string; spiegazione: string }>
> = {
  punti: {
    etichetta: "Punti",
    spiegazione: "Sta più in alto chi ha più punti, sommati su tutte le tappe.",
  },
  piazzamenti: {
    etichetta: "Piazzamenti",
    spiegazione:
      "A pari punti conta chi ha più primi posti di tappa, poi più secondi posti, e così via.",
  },
  ultima_tappa: {
    etichetta: "Tappa più recente",
    spiegazione:
      "Poi conta il miglior piazzamento nella tappa più recente; se è uguale, nella tappa precedente, e così via.",
  },
  meno_tappe: {
    etichetta: "Tappe giocate",
    spiegazione: "Poi sta più in alto chi ha giocato meno tappe.",
  },
};

export const SPIEGAZIONE_PARI_MERITO =
  "Se la parità resta dopo tutti i criteri, i giocatori condividono la stessa posizione.";

export type RegolaGenerale = {
  /** Applied in order; the first criterion that differs decides. */
  criteri: readonly CriterioGenerale[];
};

/** The circuit's rule (Q-06). */
export const REGOLA_GENERALE: RegolaGenerale = {
  criteri: ["punti", "piazzamenti", "ultima_tappa", "meno_tappe"],
};

export function spiegaRegolaGenerale(
  regola: RegolaGenerale = REGOLA_GENERALE,
): string[] {
  return [
    ...regola.criteri.map((id) => CRITERI_GENERALE_TESTO[id].spiegazione),
    SPIEGAZIONE_PARI_MERITO,
  ];
}

/** Stage places of a player, best first (null = no place). */
function piazzamenti(t: TotaleGiocatore): number[] {
  return t.tappe
    .map((r) => r.posizione)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
}

/** Lower place is better; a missing place is worse than any place. */
function confrontaPosto(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a - b;
}

/** < 0 when `a` ranks above `b` on `criterio`, 0 when level. */
function confronta(
  criterio: CriterioGenerale,
  a: TotaleGiocatore,
  b: TotaleGiocatore,
): number {
  switch (criterio) {
    case "punti":
      return b.punti - a.punti;
    case "piazzamenti": {
      // More 1st places first, then more 2nd places, …: comparing the
      // sorted places pairwise does exactly that.
      const pa = piazzamenti(a);
      const pb = piazzamenti(b);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = confrontaPosto(pa[i] ?? null, pb[i] ?? null);
        if (diff !== 0) return diff;
      }
      return 0;
    }
    case "ultima_tappa": {
      const date = [
        ...new Set([...a.tappe, ...b.tappe].map((t) => t.data)),
      ].sort((x, y) => y.localeCompare(x));
      const posto = (t: TotaleGiocatore, data: string) => {
        const posti = t.tappe
          .filter((r) => r.data === data)
          .map((r) => r.posizione)
          .filter((p): p is number => p !== null);
        return posti.length > 0 ? Math.min(...posti) : null;
      };
      for (const data of date) {
        const diff = confrontaPosto(posto(a, data), posto(b, data));
        if (diff !== 0) return diff;
      }
      return 0;
    }
    case "meno_tappe":
      return a.tappeGiocate - b.tappeGiocate;
  }
}

function confrontaRegola(
  regola: RegolaGenerale,
  a: TotaleGiocatore,
  b: TotaleGiocatore,
): number {
  for (const criterio of regola.criteri) {
    const diff = confronta(criterio, a, b);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Ranks the totals: players level on every criterion share a place and
 * the next place skips (1, 1, 3). Level players are listed by name.
 */
export function ordinaClassifica(
  totali: readonly TotaleGiocatore[],
  regola: RegolaGenerale = REGOLA_GENERALE,
): RigaGenerale[] {
  const ordinati = [...totali].sort(
    (a, b) =>
      confrontaRegola(regola, a, b) ||
      a.nome.localeCompare(b.nome, "it") ||
      a.utenteId.localeCompare(b.utenteId),
  );
  const posizioni: number[] = [];
  ordinati.forEach((t, i) => {
    posizioni.push(
      i > 0 && confrontaRegola(regola, ordinati[i - 1], t) === 0
        ? posizioni[i - 1]
        : i + 1,
    );
  });
  return ordinati.map((t, i) => ({
    utenteId: t.utenteId,
    nome: t.nome,
    anonimo: t.anonimo,
    posizione: posizioni[i],
    punti: t.punti,
    tappeGiocate: t.tappeGiocate,
    puntiProvvisori: t.puntiProvvisori,
    pariMerito: posizioni.filter((p) => p === posizioni[i]).length > 1,
    tappe: t.tappe,
  }));
}
