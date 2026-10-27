import type { Categoria } from "@/lib/db/types";
import type {
  ComposizioneGironi,
  GiocatoreGirone,
} from "@/lib/gironi/editor/types";
import type { PunteggioPerso } from "@/lib/gironi/rigenera/types";
import {
  creaDemoGironi,
  getDemoGironi,
  sostituisciDemoGironi,
} from "./gironi-editor";

/**
 * In-memory scores of the demo boards for the regeneration (no Supabase
 * env: CI, e2e). Seeded stages have none; `creaDemoRigenerazione` makes a
 * board with N scores for one e2e test. Same rules as RPC
 * `rigenera_gironi()` of migration 20261027370000_rigenera_gironi.sql.
 */
type Store = Map<string, PunteggioPerso[]>;

const STORE_KEY = Symbol.for("blvs.demo.rigeneraGironi");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

const chiave = (tappaId: string, categoria: Categoria) =>
  `${tappaId}:${categoria}`;

export function getDemoPunteggiPersi(
  tappaId: string,
  categoria: Categoria,
): PunteggioPerso[] {
  return structuredClone(store().get(chiave(tappaId, categoria)) ?? []);
}

/** Group matches with a score, in the order the RPC lists them. */
function punteggiDemo(
  composizione: ComposizioneGironi,
  n: number,
): PunteggioPerso[] {
  const coppie: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2],
  ];
  const punteggi: PunteggioPerso[] = [];
  for (const girone of composizione.gironi) {
    coppie.forEach(([a1, a2, b1, b2], i) => {
      if (punteggi.length >= n || girone.giocatori.length < 4) return;
      const g = girone.giocatori;
      punteggi.push({
        partitaId: `demo-partita-${crypto.randomUUID()}`,
        girone: girone.nome,
        turno: i + 1,
        stato: "conclusa",
        sets:
          i % 2 === 0
            ? [
                { a: 21, b: 18 },
                { a: 19, b: 21 },
                { a: 15, b: 12 },
              ]
            : [
                { a: 21, b: 15 },
                { a: 21, b: 19 },
              ],
        squadraA: [g[a1].nome, g[a2].nome],
        squadraB: [g[b1].nome, g[b2].nome],
      });
    });
  }
  return punteggi;
}

/**
 * A board for one e2e test with `punteggi` scores already entered, so
 * parallel projects never share it. Only reachable through the demo-only
 * route `POST /api/demo/rigenera-gironi`.
 */
export function creaDemoRigenerazione({
  punteggi = 0,
  giocatori = 16,
}: {
  punteggi?: number;
  giocatori?: number;
}): { id: string; categoria: Categoria } {
  const board = creaDemoGironi({ giocatori, bloccata: punteggi > 0 });
  const editor = getDemoGironi(board.id, board.categoria)!;
  store().set(
    chiave(board.id, board.categoria),
    punteggiDemo(editor.composizione, punteggi),
  );
  return board;
}

/** A random draw of every player of the board into groups of 4. */
function sorteggio(c: ComposizioneGironi): ComposizioneGironi {
  const tutti: GiocatoreGirone[] = [
    ...c.gironi.flatMap((g) => g.giocatori),
    ...c.nonAssegnati,
  ];
  for (let i = tutti.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tutti[i], tutti[j]] = [tutti[j], tutti[i]];
  }
  const n = Math.floor(tutti.length / 4);
  return {
    ...c,
    bloccata: false,
    gironi: Array.from({ length: n }, (_, i) => ({
      id: `demo-${crypto.randomUUID()}`,
      nome: `Girone ${i < 26 ? String.fromCharCode(65 + i) : i + 1}`,
      posizione: i + 1,
      fase: c.fase,
      giocatori: tutti.slice(i * 4, i * 4 + 4),
    })),
    nonAssegnati: tutti.slice(n * 4),
  };
}

export type EsitoDemoRigenerazione =
  | { esito: "ok"; persi: number; gironi: number }
  | { esito: "confermaRichiesta" | "cambiati"; punteggi: PunteggioPerso[] }
  | { esito: "nonTrovato" };

export function rigeneraDemoGironi(
  tappaId: string,
  categoria: Categoria,
  { conferma, attesi }: { conferma: boolean; attesi: number },
): EsitoDemoRigenerazione {
  if (!getDemoGironi(tappaId, categoria)) return { esito: "nonTrovato" };
  const punteggi = getDemoPunteggiPersi(tappaId, categoria);
  if (punteggi.length > 0 && !conferma) {
    return { esito: "confermaRichiesta", punteggi };
  }
  if (punteggi.length !== attesi) return { esito: "cambiati", punteggi };
  const composizione = sostituisciDemoGironi(tappaId, categoria, sorteggio)!;
  store().delete(chiave(tappaId, categoria));
  return {
    esito: "ok",
    persi: punteggi.length,
    gironi: composizione.gironi.length,
  };
}
