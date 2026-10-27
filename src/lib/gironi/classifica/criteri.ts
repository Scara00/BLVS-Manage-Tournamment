/**
 * Tie-break criteria for the group standing (R-40, Q-03). Each criterion
 * carries the sentence the rules page shows, so the copy is written once.
 */

export const CRITERI_SPAREGGIO = [
  "vittorie",
  "scontro_diretto",
  "differenza_punti",
  "punti_fatti",
] as const;

export type CriterioSpareggio = (typeof CRITERI_SPAREGGIO)[number];

export type DescrizioneCriterio = {
  id: CriterioSpareggio;
  /** Short name, e.g. for a table header or a «deciso da» note. */
  etichetta: string;
  /** One sentence for the rules page. */
  spiegazione: string;
};

export const CRITERI: Readonly<Record<CriterioSpareggio, DescrizioneCriterio>> =
  {
    vittorie: {
      id: "vittorie",
      etichetta: "Vittorie",
      spiegazione: "Chi ha vinto più partite del girone sta più in alto.",
    },
    scontro_diretto: {
      id: "scontro_diretto",
      etichetta: "Scontri diretti",
      spiegazione:
        "Tra i giocatori ancora pari contano solo le partite in cui si sono affrontati: sta più in alto chi ne ha vinte di più.",
    },
    differenza_punti: {
      id: "differenza_punti",
      etichetta: "Differenza punti",
      spiegazione:
        "Poi conta la differenza tra i punti fatti e i punti subiti in tutte le partite del girone.",
    },
    punti_fatti: {
      id: "punti_fatti",
      etichetta: "Punti fatti",
      spiegazione: "Poi conta il totale dei punti fatti nel girone.",
    },
  };

/** Text shown when every criterion leaves two or more players level. */
export const SPIEGAZIONE_PARITA_PERFETTA =
  "Se i giocatori restano pari dopo tutti i criteri, la parità è «da risolvere»: il girone non va avanti finché l'organizzazione non decide l'ordine.";

export type RegolaClassifica = {
  /** Applied in order; ties are broken by the first criterion that differs. */
  criteri: readonly CriterioSpareggio[];
};

/**
 * The circuit's rule. TODO(Q-03): the order is the one agreed for now
 * (wins, head-to-head, point difference, points scored); change it here
 * only.
 */
export const REGOLA_CLASSIFICA: RegolaClassifica = {
  criteri: ["vittorie", "scontro_diretto", "differenza_punti", "punti_fatti"],
};

/** The rules-page copy, in the order the criteria apply. */
export function spiegaRegolaClassifica(
  regola: RegolaClassifica = REGOLA_CLASSIFICA,
): string[] {
  return [
    ...regola.criteri.map((id) => CRITERI[id].spiegazione),
    SPIEGAZIONE_PARITA_PERFETTA,
  ];
}
