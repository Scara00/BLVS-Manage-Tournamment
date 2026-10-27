/**
 * «Concludi tabellone» (BLVS-43): when a board can be closed. The server
 * (`concludi_tabellone`) enforces the match rules again; open perfect ties
 * are checked here only, like `puoAvanzare`, because standings are
 * computed on read.
 */
import type { DecisioneSpareggio } from "@/lib/gironi/classifica";
import type { FaseGioco, SetPunteggio, StatoTappa } from "@/lib/db/types";
import type {
  ClassificaTappa,
  FinaleTappa,
  GiocatoreFinale,
} from "@/lib/tappe/classifica/classifica";
import { faseDellaFinale } from "@/lib/tappe/classifica/dati";
import { vincitore } from "@/lib/tappe/live-admin/format";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";

/** A final with a tie the admin still has to decide (w-admin-parita). */
export type FinaleConParita = { gironeId: string; nome: string };

/** Why a board cannot be closed now; null = it can. */
export type BloccoChiusura =
  | { motivo: "concluso" }
  | { motivo: "tappa"; stato: StatoTappa }
  | { motivo: "fase" }
  | { motivo: "partite"; daConcludere: number }
  | { motivo: "parita"; finali: FinaleConParita[] };

/** The board's matches not concluded with a winner (voided ones aside). */
export function partiteDaConcludere(
  partite: readonly PartitaLive[],
): PartitaLive[] {
  return partite.filter(
    (p) =>
      p.stato !== "annullata" &&
      (p.stato !== "conclusa" || vincitore(p.sets) === null),
  );
}

/** The final groups of a board, by `gironi.fase` (gold first). */
export function finaliDelTabellone(
  partite: readonly PartitaLive[],
): FinaleConParita[] {
  const finali = new Map<string, FinaleConParita & { ordine: number }>();
  for (const p of partite) {
    const fase = faseDellaFinale(p.gironeFase ?? null);
    if (!fase || !p.gironeId || finali.has(p.gironeId)) continue;
    finali.set(p.gironeId, {
      gironeId: p.gironeId,
      nome: p.gironeNome ?? "",
      ordine: fase === "gold" ? 0 : 1,
    });
  }
  return [...finali.values()]
    .sort((a, b) => a.ordine - b.ordine)
    .map(({ gironeId, nome }) => ({ gironeId, nome }));
}

/**
 * The first rule that blocks the closing, in the order the admin fixes
 * them: stage, phase, matches, ties.
 */
export function bloccoChiusura({
  statoTappa,
  faseGioco,
  conclusoIl,
  partite,
  classifica,
}: {
  statoTappa: StatoTappa;
  faseGioco: FaseGioco | null;
  conclusoIl: string | null;
  partite: readonly PartitaLive[];
  /** The board's stage standing (BLVS-40), for the open ties. */
  classifica: ClassificaTappa | null;
}): BloccoChiusura | null {
  if (conclusoIl !== null) return { motivo: "concluso" };
  if (statoTappa !== "in_corso") return { motivo: "tappa", stato: statoTappa };
  const finali = finaliDelTabellone(partite);
  if (faseGioco !== "finali" || finali.length < 2) return { motivo: "fase" };
  const daConcludere = partiteDaConcludere(partite).length;
  if (daConcludere > 0) return { motivo: "partite", daConcludere };

  const fasiConParita = new Set(
    (classifica?.righe ?? []).filter((r) => r.daRisolvere).map((r) => r.fase),
  );
  if (fasiConParita.size > 0) {
    return {
      motivo: "parita",
      finali: finali.filter((f) => {
        const fase = faseDellaFinale(
          partite.find((p) => p.gironeId === f.gironeId)?.gironeFase ?? null,
        );
        return fase !== undefined && fasiConParita.has(fase);
      }),
    };
  }
  return null;
}

/** Both finals concluded with a winner: «Concludi tabellone» is offered. */
export function finaliConcluse(
  faseGioco: FaseGioco | null,
  partite: readonly PartitaLive[],
): boolean {
  if (faseGioco !== "finali") return false;
  const finali = partite.filter(
    (p) => faseDellaFinale(p.gironeFase ?? null) !== undefined,
  );
  return (
    finaliDelTabellone(partite).length >= 2 &&
    partiteDaConcludere(finali).length === 0
  );
}

const nomeGiocatore = (g: { nome: string; cognome: string }) =>
  `${g.nome} ${g.cognome}`.trim();

/**
 * The finals of a board from w-admin-live's matches (demo, and the
 * «what changes» preview). Withdrawals are not known here.
 */
export function finaliDaPartite(
  partite: readonly PartitaLive[],
  decisioni: (gironeId: string) => readonly DecisioneSpareggio[] = () => [],
): FinaleTappa[] {
  return finaliDelTabellone(partite).map(({ gironeId }) => {
    const sue = partite.filter((p) => p.gironeId === gironeId);
    const giocatori = new Map<string, GiocatoreFinale>();
    for (const p of sue) {
      for (const g of [...p.squadraA, ...p.squadraB]) {
        giocatori.set(g.iscrizioneId, {
          iscrizioneId: g.iscrizioneId,
          nome: nomeGiocatore(g) || g.iscrizioneId,
          ritirato: false,
        });
      }
    }
    return {
      gironeId,
      fase: faseDellaFinale(sue[0]?.gironeFase ?? null) ?? null,
      giocatori: [...giocatori.values()].sort((a, b) =>
        a.iscrizioneId.localeCompare(b.iscrizioneId),
      ),
      partite: sue.map((p) => ({
        id: p.id,
        stato: p.stato,
        squadre: {
          A: p.squadraA.map((g) => g.iscrizioneId),
          B: p.squadraB.map((g) => g.iscrizioneId),
        },
        sets: p.sets,
      })),
      decisioni: decisioni(gironeId),
    };
  });
}

/** The same finals with one match's sets replaced (a correction). */
export function conSetsCorretti(
  finali: readonly FinaleTappa[],
  partitaId: string,
  sets: readonly SetPunteggio[],
): FinaleTappa[] {
  return finali.map((f) => ({
    ...f,
    partite: f.partite.map((p) =>
      p.id === partitaId ? { ...p, sets: [...sets] } : p,
    ),
  }));
}
