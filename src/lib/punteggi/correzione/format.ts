import type { SetPunteggio, StatoPartita } from "@/lib/db/types";
import { contaPunteggi } from "@/lib/gironi/rigenera/format";
import type { ImpattoFase, PartitaFaseSuccessiva } from "./types";

export {
  avvisoPerdita,
  descriviSets,
  descriviSquadra,
  erroreConferma,
  etichettaConferma,
} from "@/lib/gironi/rigenera/format";

export const FASE_LABEL: Record<PartitaFaseSuccessiva["fase"], string> = {
  eliminazione: "Eliminazione",
  finale: "Finale",
};

/** «Finale · turno 1». */
export function descriviPartitaSuccessiva(p: PartitaFaseSuccessiva): string {
  return `${FASE_LABEL[p.fase]} · turno ${p.turno}`;
}

/** The dialog's lead: what exists and what «Rigenera» would lose. */
export function riepilogoImpatto({ partite, punteggiPersi }: ImpattoFase) {
  const n = partite.length;
  const generate = n === 1 ? "1 partita" : `${n} partite`;
  return punteggiPersi === 0
    ? `La fase successiva è già generata (${generate}), ancora senza punteggi.`
    : `La fase successiva è già generata (${generate}): ${contaPunteggi(punteggiPersi)} già ${punteggiPersi === 1 ? "inserito" : "inseriti"}.`;
}

/** The outcome after the save, appended to «Punteggio corretto». */
export function esitoScelta(
  scelta: "mantieni" | "rigenera" | null | undefined,
  persi: number,
): string | null {
  if (scelta === "mantieni") return "La fase successiva resta com'era.";
  if (scelta === "rigenera") {
    return persi === 0
      ? "La fase successiva è stata eliminata e va generata di nuovo."
      : `La fase successiva è stata eliminata e va generata di nuovo: ${persi === 1 ? "perso 1 punteggio" : `persi ${persi} punteggi`}, annotati nel registro.`;
  }
  return null;
}

/** «La fase successiva è cambiata»: the dialog reopens with the new count. */
export function messaggioImpattoCambiato(n: number): string {
  return n === 0
    ? "Nel frattempo la fase successiva è cambiata: ora non si perde nessun punteggio. Scegli di nuovo."
    : `Nel frattempo la fase successiva è cambiata: ora si perdono ${contaPunteggi(n)}. Controlla l'elenco e scegli di nuovo.`;
}

/** A row of RPC `fase_successiva_correzione`. */
export type PartitaSuccessivaRow = {
  partita_id: string;
  fase: string;
  turno: number;
  stato: StatoPartita;
  sets: unknown;
  squadra_a: string[] | null;
  squadra_b: string[] | null;
};

function sets(value: unknown): SetPunteggio[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) =>
    s &&
    typeof s === "object" &&
    Number.isFinite((s as SetPunteggio).a) &&
    Number.isFinite((s as SetPunteggio).b)
      ? [{ a: (s as SetPunteggio).a, b: (s as SetPunteggio).b }]
      : [],
  );
}

export function toImpattoFase(
  rows: readonly PartitaSuccessivaRow[],
): ImpattoFase {
  const partite = rows.map((r): PartitaFaseSuccessiva => ({
    id: r.partita_id,
    fase: r.fase === "eliminazione" ? "eliminazione" : "finale",
    turno: r.turno,
    stato: r.stato,
    sets: sets(r.sets),
    squadre: { a: r.squadra_a ?? [], b: r.squadra_b ?? [] },
  }));
  return {
    partite,
    punteggiPersi: partite.filter((p) => p.sets.length > 0).length,
  };
}
