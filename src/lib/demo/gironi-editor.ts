import type { Categoria, FaseTabellone } from "@/lib/db/types";
import { composizioneDemo } from "@/lib/gironi/editor/fixtures";
import { applicaOperazione } from "@/lib/gironi/editor/operazioni";
import type {
  ComposizioneGironi,
  EditorGironi,
  OperazioneGironi,
} from "@/lib/gironi/editor/types";
import { getDemoTappaGestione } from "./gestione-tappe";

/**
 * In-memory groups for the editor when Supabase is not configured (CI,
 * e2e), like the other demo stores: one server instance, reset on restart.
 * A board of a demo stage is seeded the first time it is opened: its
 * confirmed players, in order, in groups of 4. It applies the same rules
 * as the RPCs of migration 20261027350000_editor_gironi.sql.
 */
type Store = Map<string, EditorGironi>;

const STORE_KEY = Symbol.for("blvs.demo.gironiEditor");

/** Demo boards have no Gold/Silver of their own: M plays Gold, F Silver. */
const FASE_DEMO: Record<Categoria, FaseTabellone> = { M: "gold", F: "silver" };

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

const chiave = (tappaId: string, categoria: Categoria) =>
  `${tappaId}:${categoria}`;

function copy(editor: EditorGironi): EditorGironi {
  return structuredClone(editor);
}

function seed(tappaId: string, categoria: Categoria): EditorGironi | null {
  const tappa = getDemoTappaGestione(tappaId);
  if (!tappa) return null;
  const board = tappa.tabelloni.find((t) => t.categoria === categoria);
  const composizione = composizioneDemo({
    giocatori: board?.confermate ?? 0,
    fase: FASE_DEMO[categoria],
    tabelloneId: `${tappaId}-${categoria}`,
  });
  return {
    tappa: { id: tappaId, nome: tappa.row.nome },
    categoria,
    composizione,
  };
}

export function getDemoGironi(
  tappaId: string,
  categoria: Categoria,
): EditorGironi | null {
  const key = chiave(tappaId, categoria);
  let editor = store().get(key);
  if (!editor) {
    const nuovo = seed(tappaId, categoria);
    if (!nuovo) return null;
    store().set(key, nuovo);
    editor = nuovo;
  }
  return copy(editor);
}

export type EsitoDemoGironi =
  | { esito: "ok" | "conflitto" | "bloccata"; composizione: ComposizioneGironi }
  | { esito: "nonTrovato" };

/** Saves one change, as the RPCs do: version check, then +1. */
export function modificaDemoGironi(
  tappaId: string,
  categoria: Categoria,
  versione: number,
  operazione: OperazioneGironi,
): EsitoDemoGironi {
  if (!getDemoGironi(tappaId, categoria)) return { esito: "nonTrovato" };
  const editor = store().get(chiave(tappaId, categoria))!;
  const attuale = editor.composizione;
  if (attuale.versione !== versione) {
    return { esito: "conflitto", composizione: structuredClone(attuale) };
  }
  if (attuale.bloccata) {
    return { esito: "bloccata", composizione: structuredClone(attuale) };
  }
  const esito = applicaOperazione(
    attuale,
    operazione,
    () => `demo-${crypto.randomUUID()}`,
  );
  if (!esito.ok) return { esito: "nonTrovato" };
  if (esito.composizione !== attuale) {
    editor.composizione = { ...esito.composizione, versione: versione + 1 };
  }
  return { esito: "ok", composizione: structuredClone(editor.composizione) };
}

/**
 * Adds a board for one e2e test, so parallel projects never share it.
 * Only reachable through the demo-only route `POST /api/demo/gironi`.
 */
export function creaDemoGironi({
  giocatori = 16,
  gironi,
  fase = "gold",
  bloccata = false,
}: {
  giocatori?: number;
  gironi?: number;
  fase?: FaseTabellone | null;
  bloccata?: boolean;
}): { id: string; categoria: Categoria } {
  const id = `e2e-gironi-${crypto.randomUUID()}`;
  store().set(chiave(id, "M"), {
    tappa: { id, nome: `Tappa di prova ${id.slice(11, 17)}` },
    categoria: "M",
    composizione: composizioneDemo({
      giocatori,
      gironi,
      fase,
      bloccata,
      tabelloneId: `${id}-M`,
    }),
  });
  return { id, categoria: "M" };
}

/**
 * Replaces a demo board's composition (BLVS-30 regeneration). The change
 * function receives a copy; the version grows by 1, as the RPC does.
 */
export function sostituisciDemoGironi(
  tappaId: string,
  categoria: Categoria,
  cambia: (attuale: ComposizioneGironi) => ComposizioneGironi,
): ComposizioneGironi | null {
  if (!getDemoGironi(tappaId, categoria)) return null;
  const editor = store().get(chiave(tappaId, categoria))!;
  const versione = editor.composizione.versione + 1;
  editor.composizione = {
    ...cambia(structuredClone(editor.composizione)),
    versione,
  };
  return structuredClone(editor.composizione);
}
