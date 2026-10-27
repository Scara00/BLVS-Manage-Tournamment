import type { SetPunteggio } from "@/lib/db/types";
import type { EsitoInvio, InvioPunteggio } from "@/lib/punteggi/coda/types";

/**
 * In-memory scores for the demo/e2e (no Supabase env), with the same rules
 * as `salva_punteggio_coda()`: a key saves once, a stale version is a
 * conflict. `scritture` counts real writes, so e2e can check «invio unico».
 */
type DemoPartita = {
  sets: SetPunteggio[];
  versione: number;
  scritture: number;
  chiavi: Set<string>;
};

/** Demo cookie that makes the queue's server action answer «sessione chiusa». */
export const DEMO_SESSIONE_CHIUSA_COOKIE = "blvs_demo_sessione_chiusa";

const store = globalThis as typeof globalThis & {
  __blvsDemoCodaPunteggi?: Map<string, DemoPartita>;
};

function partite(): Map<string, DemoPartita> {
  store.__blvsDemoCodaPunteggi ??= new Map();
  return store.__blvsDemoCodaPunteggi;
}

/** A new demo match with an empty score at version 1. */
export function creaDemoPartitaPunteggio(): { partitaId: string; versione: 1 } {
  const partitaId = crypto.randomUUID();
  partite().set(partitaId, {
    sets: [],
    versione: 1,
    scritture: 0,
    chiavi: new Set(),
  });
  return { partitaId, versione: 1 };
}

export function leggiDemoPartitaPunteggio(partitaId: string) {
  const p = partite().get(partitaId);
  return p
    ? { sets: p.sets, versione: p.versione, scritture: p.scritture }
    : null;
}

/** Another admin saves on the demo match (e2e conflict). */
export function modificaDemoPartitaPunteggio(
  partitaId: string,
  sets: SetPunteggio[],
) {
  const p = partite().get(partitaId);
  if (!p) return null;
  p.sets = sets;
  p.versione += 1;
  p.scritture += 1;
  return { sets: p.sets, versione: p.versione };
}

export function salvaDemoPunteggio(invio: InvioPunteggio): EsitoInvio {
  const p = partite().get(invio.partitaId);
  if (!p) return { status: "rifiutato", message: "La partita non esiste più." };
  const punteggio = { sets: p.sets, versione: p.versione };
  if (p.chiavi.has(invio.chiave))
    return { status: "salvato", punteggio, duplicato: true };
  if (p.versione !== invio.versione) return { status: "conflitto", punteggio };
  p.sets = invio.sets;
  p.versione += 1;
  p.scritture += 1;
  p.chiavi.add(invio.chiave);
  return {
    status: "salvato",
    punteggio: { sets: p.sets, versione: p.versione },
    duplicato: false,
  };
}
