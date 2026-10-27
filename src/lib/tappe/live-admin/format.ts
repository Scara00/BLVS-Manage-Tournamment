import {
  FASI_PARTITA,
  type FaseGioco,
  type FasePartita,
  type SetPunteggio,
  type StatoPartita,
} from "@/lib/db/types";
import {
  FASE_GIOCO_DEL_LIVELLO,
  FASE_GIOCO_LABEL,
  livelloGirone,
} from "@/lib/gironi/fasi/fase";
import type { GiocatorePartita, PartitaLive } from "./types";

/** The state of a match, always as text (never colour only). */
export const STATO_PARTITA_LABEL: Record<StatoPartita, string> = {
  programmata: "Da giocare",
  in_corso: "In corso",
  conclusa: "Conclusa",
  annullata: "Annullata",
};

export const FASE_PARTITA_LABEL: Record<FasePartita, string> = {
  gironi: "Gironi",
  eliminazione: "Eliminazione",
  finale: "Finale",
};

export { FASE_GIOCO_LABEL };

/**
 * The matches of the board's current game phase (BLVS-39): the initial
 * and the gold/silver groups are both `fase = 'gironi'`, so their progress
 * is told apart by the group's phase. Matches without one count as
 * initial.
 */
export function partiteFaseGioco(
  partite: readonly PartitaLive[],
  faseGioco: FaseGioco | null,
): PartitaLive[] {
  if (faseGioco === null) return [...partite];
  return partite.filter(
    (p) =>
      FASE_GIOCO_DEL_LIVELLO[livelloGirone(p.gironeFase ?? "iniziale")] ===
      faseGioco,
  );
}

/**
 * A match whose result the admin still has to enter. Same rule as
 * `partite_da_inserire` in `admin_riepilogo_tappe()` (migration
 * 20261027340100_annulla_archivia_tappa.sql, BLVS-17): change both together.
 */
export function isDaInserire(partita: PartitaLive, adesso: Date): boolean {
  if (partita.stato === "in_corso") return true;
  return (
    partita.stato === "programmata" &&
    partita.programmataIl !== null &&
    new Date(partita.programmataIl).getTime() <= adesso.getTime() &&
    partita.sets.length === 0
  );
}

function perGironeETurno(a: PartitaLive, b: PartitaLive): number {
  return (
    a.gironePosizione - b.gironePosizione ||
    (a.gironeNome ?? "").localeCompare(b.gironeNome ?? "", "it") ||
    a.turno - b.turno ||
    a.id.localeCompare(b.id)
  );
}

export type GironePartite = {
  /** Group id, or `null` for the matches of a phase without groups. */
  id: string | null;
  nome: string | null;
  partite: PartitaLive[];
};

export type FasePartite = {
  fase: FasePartita;
  label: string;
  gironi: GironePartite[];
};

/**
 * Every match by phase (gironi → eliminazione → finale), then by group
 * (board order), then by round. Phases without matches are left out.
 */
export function raggruppaPartite(
  partite: readonly PartitaLive[],
): FasePartite[] {
  return FASI_PARTITA.flatMap((fase) => {
    const diFase = partite.filter((p) => p.fase === fase).sort(perGironeETurno);
    if (diFase.length === 0) return [];
    const gironi: GironePartite[] = [];
    for (const partita of diFase) {
      const ultimo = gironi.at(-1);
      if (ultimo && ultimo.id === partita.gironeId) {
        ultimo.partite.push(partita);
      } else {
        gironi.push({
          id: partita.gironeId,
          nome: partita.gironeNome,
          partite: [partita],
        });
      }
    }
    return [{ fase, label: FASE_PARTITA_LABEL[fase], gironi }];
  });
}

/** The most advanced phase that has matches, or null for none. */
export function faseCorrente(
  partite: readonly PartitaLive[],
): FasePartita | null {
  for (const fase of [...FASI_PARTITA].reverse()) {
    if (partite.some((p) => p.fase === fase)) return fase;
  }
  return null;
}

export type Avanzamento = {
  /** Matches of the phase, cancelled ones excluded. */
  totale: number;
  daGiocare: number;
  inCorso: number;
  concluse: number;
  daInserire: number;
  /** Concluded out of the total, 0–100, rounded down. */
  percentuale: number;
};

/** Progress of one phase: how many of its matches are concluded. */
export function avanzamentoFase(
  partite: readonly PartitaLive[],
  fase: FasePartita | null,
  adesso: Date,
): Avanzamento {
  const diFase = partite.filter(
    (p) => p.fase === fase && p.stato !== "annullata",
  );
  const conta = (stato: StatoPartita) =>
    diFase.filter((p) => p.stato === stato).length;
  const totale = diFase.length;
  const concluse = conta("conclusa");
  return {
    totale,
    daGiocare: conta("programmata"),
    inCorso: conta("in_corso"),
    concluse,
    daInserire: diFase.filter((p) => isDaInserire(p, adesso)).length,
    percentuale: totale === 0 ? 0 : Math.floor((concluse / totale) * 100),
  };
}

/** «8 di 24 partite concluse», «1 di 1 partita conclusa». */
export function avanzamentoLabel({ concluse, totale }: Avanzamento): string {
  return totale === 1
    ? `${concluse} di 1 partita conclusa`
    : `${concluse} di ${totale} partite concluse`;
}

/** The matches being played, for the cards at the top. */
export function partiteInCorso(partite: readonly PartitaLive[]): PartitaLive[] {
  return partite.filter((p) => p.stato === "in_corso").sort(perGironeETurno);
}

/** «Girone A · turno 2», or «Finale · turno 1» without a group. */
export function descriviPartita(partita: PartitaLive): string {
  const dove = partita.gironeNome ?? FASE_PARTITA_LABEL[partita.fase];
  return `${dove} · turno ${partita.turno}`;
}

/** «Rossi e Bianchi». */
export function squadraLabel(giocatori: readonly GiocatorePartita[]): string {
  const cognomi = giocatori.map((g) => g.cognome || g.nome);
  if (cognomi.length <= 1) return cognomi.join("");
  return `${cognomi.slice(0, -1).join(", ")} e ${cognomi.at(-1)}`;
}

/** «21-18 · 19-21», or null with no sets. */
export function setsLabel(sets: readonly SetPunteggio[]): string | null {
  if (sets.length === 0) return null;
  return sets.map((s) => `${s.a}-${s.b}`).join(" · ");
}

/** The team that won more sets, or null (no sets, or as many won). */
export function vincitore(sets: readonly SetPunteggio[]): "A" | "B" | null {
  const a = sets.filter((s) => s.a > s.b).length;
  const b = sets.filter((s) => s.b > s.a).length;
  if (a === b) return null;
  return a > b ? "A" : "B";
}
