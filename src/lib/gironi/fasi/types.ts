import type { Categoria, FaseGioco } from "@/lib/db/types";
import type { GironeProposto } from "./qualificazione";

/** The step after a group phase: the gold/silver groups, or the finals. */
export type TipoProssimaFase = "gold_silver" | "finali";

/**
 * Where the step is:
 * - `in_corso`: some matches of the phase just played are still missing;
 * - `parita`: a group has a perfect tie to resolve first (R-40);
 * - `non_componibile`: the groups can't make the next phase in automatic;
 * - `pronta`: the proposal can be saved (`anteprima`);
 * - `proposta`: the gold/silver groups are proposed, not started yet;
 * - `fatta`: the finals exist.
 */
export type StatoProssimaFase =
  "in_corso" | "parita" | "non_componibile" | "pronta" | "proposta" | "fatta";

export type GironeDaRisolvere = { id: string; nome: string; href: string };

export type ProssimaFaseView = {
  tappa: { id: string; nome: string };
  categoria: Categoria;
  tipo: TipoProssimaFase;
  /** The board's current game phase. */
  faseGioco: FaseGioco | null;
  stato: StatoProssimaFase;
  /** Groups still in play (`in_corso`) or with an open tie (`parita`). */
  gironi: GironeDaRisolvere[];
  /** Why the next phase can't be made (`non_componibile`). */
  messaggio: string | null;
  anteprima: GironeProposto[];
  /** Warnings on the proposal, e.g. a group of 2 to complete. */
  avvisi: string[];
};

export type ProssimaFaseState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | {
      status: "error";
      reason:
        | "blocked"
        | "conflict"
        | "sessionExpired"
        | "permissionDenied"
        | "network";
      message: string;
      at: number;
    };

export const initialProssimaFaseState: ProssimaFaseState = { status: "idle" };

export type ProssimaFaseAction = (
  prev: ProssimaFaseState,
  formData: FormData,
) => Promise<ProssimaFaseState>;

export const PROSSIMA_FASE_MESSAGES = {
  propostaSalvata:
    "Proposta salvata: controlla i gironi gold e silver qui sotto e modificali se serve, poi avviali.",
  finaliGenerate: "Finali generate: le partite sono da giocare.",
  inCorso:
    "Alcune partite non sono ancora concluse: la proposta parte quando lo sono tutte.",
  parita: "C'è una parità da risolvere: la proposta parte dopo la risoluzione.",
  conflict:
    "Il tabellone è cambiato nel frattempo: ricarica la pagina per vedere lo stato attuale.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può proporre le fasi successive.",
  network: "Non è stato possibile salvare: controlla la connessione e riprova.",
  offline: "Sei offline: potrai continuare quando la connessione torna.",
} as const;
