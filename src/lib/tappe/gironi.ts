/**
 * Rule for «gironi completi»: every phase splits its players into groups of
 * `dimensione`, and the best `qualificati` of each group move on, until a
 * single final group. A maximum is fine only if every phase divides evenly.
 * TODO(Q-01, Q-05): group size and qualifiers are still to be confirmed by
 * the client; change them here only.
 */
export type RegolaGironi = {
  /** Players per group. */
  dimensione: number;
  /** Players per group who move on to the next phase. */
  qualificati: number;
  /** Maximums suggested when the chosen one leaves incomplete groups. */
  proposte: readonly number[];
};

export const REGOLA_GIRONI: RegolaGironi = {
  dimensione: 4,
  qualificati: 2,
  proposte: [16, 32],
};

export type FasiGironi = {
  /** Whether every phase is made only of full groups. */
  completi: boolean;
  /** Number of groups per phase, as far as the split works. */
  fasi: number[];
};

/** Splits `iscritti` phase by phase under `regola`. */
export function fasiGironi(
  iscritti: number,
  regola: RegolaGironi = REGOLA_GIRONI,
): FasiGironi {
  const { dimensione, qualificati } = regola;
  if (qualificati < 1 || qualificati >= dimensione) {
    throw new Error("Regola gironi non valida: 1 ≤ qualificati < dimensione");
  }
  const fasi: number[] = [];
  let giocatori = iscritti;
  while (Number.isInteger(giocatori) && giocatori >= dimensione) {
    if (giocatori % dimensione !== 0) return { completi: false, fasi };
    const gironi = giocatori / dimensione;
    fasi.push(gironi);
    if (gironi === 1) return { completi: true, fasi };
    giocatori = gironi * qualificati;
  }
  return { completi: false, fasi };
}

/** Whether `iscritti` gives full groups in every phase. */
export function gironiCompleti(
  iscritti: number,
  regola: RegolaGironi = REGOLA_GIRONI,
): boolean {
  return fasiGironi(iscritti, regola).completi;
}
