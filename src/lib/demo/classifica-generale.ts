/**
 * Demo data of the overall standing (BLVS-44), used without Supabase env
 * (CI, e2e, local). It produces the same rows as the public RPC
 * `classifica_generale_dati`, so the real adapter builds the standing.
 *
 * Seeded seasons: 2026 (three stages, the last one still open) and 2025.
 * e2e creates its own hidden season with `creaScenarioClassificaDemo()`,
 * so parallel tests never touch each other's data.
 */
import type { Categoria, StatoPartita } from "@/lib/db/types";
import type { DatiClassificaGenerale } from "@/lib/classifica-generale/dati";

/** The demo player («Luca Rossi»), as on the other demo player pages. */
export const DEMO_ME_CLASSIFICA = "demo-u-m-01";

const NOMI: Record<Categoria, readonly string[]> = {
  M: [
    "Luca Rossi",
    "Marco Bianchi",
    "Andrea Esposito",
    "Matteo Romano",
    "Davide Colombo",
    "Simone Ricci",
    "Federico Marino",
    // Deleted account (BLVS-50): no name left, see DEMO_ANONIMI.
    "",
    "Lorenzo Bruno-Gallo de Santis",
    "Giorgio Conti",
    "Paolo Mancini",
    "Stefano Lombardi",
  ],
  F: [
    "Giulia Ferrari",
    "Chiara Russo",
    "Sara Costa",
    "Martina Fontana",
    "Elena Rizzo",
    "Francesca Moretti",
    "Valentina Barbieri",
    "Alessia Galli",
    "Federica Leone",
    "Silvia Longo",
    "Laura Gentile",
    "Anna Martinelli",
  ],
};

/**
 * Players whose account was deleted (BLVS-50): the RPC returns them as
 * «Giocatore anonimo» with `anonimo: true`, results kept.
 */
export const DEMO_ANONIMI: ReadonlySet<string> = new Set(["demo-u-m-08"]);

/** `demo-u-m-01` … : player k (1-based) of a category. */
export function demoUtente(categoria: Categoria, k: number): string {
  return `demo-u-${categoria.toLowerCase()}-${String(k).padStart(2, "0")}`;
}

type Set = [number, number];

/**
 * One final of 4, players in their expected finishing order. The three
 * King/Queen matches are AB–CD, AC–BD, AD–BC; null = still to play.
 * With the default scores the finishing order is the listed one.
 */
type DemoFinale = { giocatori: readonly number[]; risultati: (Set | null)[] };

type DemoTabellone = {
  concluso: boolean;
  gold: DemoFinale;
  silver: DemoFinale;
  /** Knocked out before the finals, with at least one match played. */
  fuori: readonly number[];
};

type DemoTappa = {
  id: string;
  nome: string;
  data: string;
  stagione: number;
  /** Hidden seasons (e2e scenarios) are not offered in the season list. */
  nascosta?: boolean;
  tabelloni: Record<Categoria, DemoTabellone>;
};

const PUNTEGGI: Set[] = [
  [21, 15],
  [21, 18],
  [21, 19],
];

const finale = (giocatori: number[], aperte = 0): DemoFinale => ({
  giocatori,
  risultati: PUNTEGGI.map((s, i) => (i >= PUNTEGGI.length - aperte ? null : s)),
});

function tabellone(
  ordine: number[],
  { concluso = true, aperte = 0 }: { concluso?: boolean; aperte?: number } = {},
): DemoTabellone {
  return {
    concluso,
    gold: finale(ordine.slice(0, 4), aperte),
    silver: finale(ordine.slice(4, 8)),
    fuori: ordine.slice(8),
  };
}

function seed(): DemoTappa[] {
  return [
    {
      id: "demo-cg-lignano-2025",
      nome: "Tappa unica · Lignano",
      data: "2025-08-30",
      stagione: 2025,
      tabelloni: {
        M: tabellone([2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11]),
        F: tabellone([1, 3, 2, 4, 5, 7, 6, 8, 9, 10, 11, 12]),
      },
    },
    {
      id: "demo-cg-jesolo",
      nome: "Tappa 1 · Jesolo",
      data: "2026-05-16",
      stagione: 2026,
      tabelloni: {
        M: tabellone([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        F: tabellone([2, 1, 3, 4, 6, 5, 7, 8, 9, 10, 11, 12]),
      },
    },
    {
      id: "demo-cg-rimini",
      nome: "Tappa 2 · Rimini",
      data: "2026-06-20",
      stagione: 2026,
      tabelloni: {
        M: tabellone([3, 1, 2, 5, 4, 6, 8, 7, 9, 10, 11, 12]),
        F: tabellone([1, 2, 4, 3, 5, 6, 8, 7, 9, 10, 11, 12]),
      },
    },
    {
      id: "demo-cg-cagliari",
      nome: "Tappa 3 · Cagliari",
      data: "2026-07-18",
      stagione: 2026,
      tabelloni: {
        M: tabellone([1, 3, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12], {
          concluso: false,
          aperte: 1,
        }),
        F: tabellone([3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12], {
          concluso: false,
        }),
      },
    },
  ];
}

type Store = { tappe: DemoTappa[]; scenari: number };

const STORE_KEY = Symbol.for("blvs.demo.classifica-generale");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= { tappe: seed(), scenari: 0 });
}

/** Seasons offered in the filter, newest first (hidden ones excluded). */
export function getDemoStagioni(): number[] {
  return [
    ...new Set(
      store()
        .tappe.filter((t) => !t.nascosta)
        .map((t) => t.stagione),
    ),
  ].sort((a, b) => b - a);
}

/** True when some stage (hidden included) counts for `stagione`. */
export function esisteStagioneDemo(stagione: number): boolean {
  return store().tappe.some((t) => t.stagione === stagione);
}

const SQUADRE: readonly [readonly number[], readonly number[]][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

/** The rows `classifica_generale_dati(categoria, stagione)` would return. */
export function getDemoDatiClassifica(
  categoria: Categoria,
  stagione: number | null,
): DatiClassificaGenerale {
  const tappe = store()
    .tappe.filter((t) =>
      stagione === null ? !t.nascosta : t.stagione === stagione,
    )
    .sort((a, b) => a.data.localeCompare(b.data));
  const dati: {
    [K in keyof DatiClassificaGenerale]: DatiClassificaGenerale[K][number][];
  } = {
    tappe: [],
    gironi: [],
    membri: [],
    partite: [],
    decisioni: [],
    iscrizioni: [],
  };
  for (const tappa of tappe) {
    const board = tappa.tabelloni[categoria];
    const iscrizione = (k: number) => `${tappa.id}-${categoria}-i${k}`;
    dati.tappe.push({
      id: tappa.id,
      nome: tappa.nome,
      data_inizio: tappa.data,
      stagione: tappa.stagione,
      concluso: board.concluso,
    });
    for (const fase of ["gold", "silver"] as const) {
      const f = board[fase];
      const gironeId = `${tappa.id}-${categoria}-finale-${fase}`;
      dati.gironi.push({
        id: gironeId,
        tappa_id: tappa.id,
        fase: `finale_${fase}`,
      });
      for (const k of f.giocatori) {
        dati.membri.push({ girone_id: gironeId, iscrizione_id: iscrizione(k) });
      }
      SQUADRE.forEach(([a, b], t) => {
        const set = f.risultati[t];
        const stato: StatoPartita = set ? "conclusa" : "programmata";
        dati.partite.push({
          id: `${gironeId}-t${t + 1}`,
          girone_id: gironeId,
          stato,
          punteggi: { sets: set ? [{ a: set[0], b: set[1] }] : [] },
          partita_giocatori: [
            ...a.map((x) => ({
              iscrizione_id: iscrizione(f.giocatori[x]),
              squadra: "A" as const,
            })),
            ...b.map((x) => ({
              iscrizione_id: iscrizione(f.giocatori[x]),
              squadra: "B" as const,
            })),
          ],
        });
      });
    }
    for (const k of [
      ...board.gold.giocatori,
      ...board.silver.giocatori,
      ...board.fuori,
    ]) {
      const utente = demoUtente(categoria, k);
      const anonimo = DEMO_ANONIMI.has(utente);
      // Like `nome_anonimo()`: the stored name of a deleted account.
      const [nome, ...cognome] = (
        anonimo ? "Giocatore anonimo" : NOMI[categoria][k - 1]
      ).split(" ");
      dati.iscrizioni.push({
        id: iscrizione(k),
        tappa_id: tappa.id,
        utente_id: utente,
        nome,
        cognome: cognome.join(" "),
        stato: "confermata",
        anonimo,
      });
    }
  }
  return dati;
}

/** First hidden scenario season; they cycle so the range never runs out. */
const PRIMA_STAGIONE_SCENARIO = 2030;
const STAGIONI_SCENARIO = 60;

export type ScenarioClassificaDemo = {
  stagione: number;
  categoria: Categoria;
  /** The open stage: one gold match still to play, board not closed. */
  tappaAperta: string;
};

/**
 * e2e fixture: a hidden season with a closed stage and an open one, whose
 * men's gold final misses its last match. The demo player is in it.
 */
export function creaScenarioClassificaDemo(): ScenarioClassificaDemo {
  const s = store();
  const stagione = PRIMA_STAGIONE_SCENARIO + (s.scenari++ % STAGIONI_SCENARIO);
  s.tappe = s.tappe.filter((t) => t.stagione !== stagione);
  const base = `demo-cg-${stagione}`;
  const aperta = `${base}-b`;
  s.tappe.push(
    {
      id: `${base}-a`,
      nome: "Tappa A · Sabaudia",
      data: `${stagione}-05-10`,
      stagione,
      nascosta: true,
      tabelloni: {
        M: tabellone([2, 3, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        F: tabellone([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      },
    },
    {
      id: aperta,
      nome: "Tappa B · Sottomarina",
      data: `${stagione}-06-14`,
      stagione,
      nascosta: true,
      tabelloni: {
        M: tabellone([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], {
          concluso: false,
          aperte: 1,
        }),
        F: tabellone([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], {
          concluso: false,
        }),
      },
    },
  );
  return { stagione, categoria: "M", tappaAperta: aperta };
}

function tappaDemo(tappaId: string): DemoTappa | undefined {
  return store().tappe.find((t) => t.id === tappaId);
}

/** The demo stage's season, or null when it is not a standings stage. */
export function stagioneTappaDemo(tappaId: string): number | null {
  return tappaDemo(tappaId)?.stagione ?? null;
}

export function nomeTappaDemo(tappaId: string): string | null {
  return tappaDemo(tappaId)?.nome ?? null;
}

/**
 * The result an admin enters for a match still to play: team B wins, so
 * in the e2e scenario the leader (the demo player) drops from 1st to 3rd
 * and the standing visibly changes.
 */
const RIBALTONE: Set = [12, 21];

/**
 * An admin enters the missing gold-final scores of a stage: every place
 * becomes definitive. Returns false for an unknown stage.
 */
export function salvaFinaleDemo(
  tappaId: string,
  categoria: Categoria,
): boolean {
  const tappa = tappaDemo(tappaId);
  if (!tappa) return false;
  const { gold } = tappa.tabelloni[categoria];
  gold.risultati = gold.risultati.map((set) => set ?? RIBALTONE);
  return true;
}

/** «Concludi tabellone» (BLVS-43) on both boards of a demo stage. */
export function concludiTabelloniDemo(tappaId: string): boolean {
  const tappa = tappaDemo(tappaId);
  if (!tappa) return false;
  for (const board of Object.values(tappa.tabelloni)) board.concluso = true;
  return true;
}
