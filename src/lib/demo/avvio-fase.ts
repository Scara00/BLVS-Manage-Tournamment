import type { Categoria, FaseGioco, FaseGirone } from "@/lib/db/types";
import {
  assegnaLettere,
  controllaAvvio,
  partiteGirone,
  type GironeAvvio,
  type IscrittoFuori,
  type ProblemaAvvio,
  type TabelloneAvvio,
} from "@/lib/tappe/avvio/regole";
import { getDemoGironi, sostituisciDemoGironi } from "./gironi-editor";
import {
  aggiungiDemoTappa,
  getDemoTappaGestione,
  segnaFaseAvviataDemo,
} from "./gestione-tappe";

/**
 * Groups of each board for the start screen when Supabase is not
 * configured (CI, e2e), on top of the demo stages of the management page.
 * One server instance, reset on restart, like the other demo stores.
 */
type DemoBoard = {
  faseGioco: FaseGioco | null;
  /** The groups of the phase in play (or about to start). */
  gironi: GironeAvvio[];
  nonAssegnati: IscrittoFuori[];
  /** Groups of the phases already played (BLVS-39). */
  precedenti?: GironeAvvio[];
  /**
   * A gold/silver proposal is waiting to start (BLVS-39): its groups live
   * in the editor's demo store, where the admin can still change them.
   */
  proposta?: boolean;
};

type Store = Map<string, DemoBoard>;

const STORE_KEY = Symbol.for("blvs.demo.avvioFase");

const COGNOMI = [
  "Rossi",
  "Bianchi",
  "Marino",
  "Greco",
  "Ferrari",
  "Costa",
  "Esposito",
  "Romano",
  "Colombo",
  "Ricci",
  "Fontana",
  "Moretti",
  "Conti",
  "Gallo",
  "Bruno",
  "Mancini",
];
const NOMI: Record<Categoria, string[]> = {
  M: ["Luca", "Marco", "Paolo", "Andrea", "Matteo", "Davide", "Simone"],
  F: ["Giulia", "Sara", "Chiara", "Marta", "Elena", "Anna", "Laura"],
};

function chiave(tappaId: string, categoria: Categoria): string {
  return `${tappaId}:${categoria}`;
}

function giocatore(tappaId: string, categoria: Categoria, i: number) {
  return {
    iscrizioneId: `${tappaId}-${categoria}-i${i + 1}`,
    utenteId: `${tappaId}-${categoria}-u${i + 1}`,
    nome: NOMI[categoria][i % NOMI[categoria].length],
    cognome: COGNOMI[i % COGNOMI.length],
    posto: i + 1,
  };
}

/**
 * `dimensioni[k]` players in group k (letters A, B, … for the group names),
 * then `fuori` players outside every group.
 */
function componi(
  tappaId: string,
  categoria: Categoria,
  dimensioni: number[],
  fuori = 0,
): DemoBoard {
  let i = 0;
  const gironi = dimensioni.map((n, k) => {
    const giocatori = Array.from({ length: n }, () =>
      giocatore(tappaId, categoria, i++),
    );
    return {
      id: `${tappaId}-${categoria}-g${k + 1}`,
      nome: `Girone ${String.fromCharCode(65 + k)}`,
      giocatori: assegnaLettere(giocatori).map(
        ({ iscrizioneId, utenteId, lettera, nome, cognome }) => ({
          iscrizioneId,
          utenteId,
          lettera,
          nome,
          cognome,
        }),
      ),
    };
  });
  const nonAssegnati = Array.from({ length: fuori }, () => {
    const { iscrizioneId, nome, cognome } = giocatore(tappaId, categoria, i++);
    return { iscrizioneId, nome, cognome };
  });
  return { faseGioco: null, gironi, nonAssegnati };
}

function seed(): Store {
  return new Map([
    // Tappa 3 · Cagliari, iscrizioni chiuse: M is blocked, F can start.
    [chiave("cagliari", "M"), componi("cagliari", "M", [4, 4, 4], 2)],
    [chiave("cagliari", "F"), componi("cagliari", "F", [4, 4])],
    // Tappa 1 · Jesolo is already in progress.
    [
      chiave("jesolo", "M"),
      { ...componi("jesolo", "M", [4, 4, 4, 4]), faseGioco: "gironi_iniziali" },
    ],
    [
      chiave("jesolo", "F"),
      { ...componi("jesolo", "F", [4, 4, 4]), faseGioco: "gironi_iniziali" },
    ],
  ]);
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= seed());
}

const copiaGirone = (g: GironeAvvio): GironeAvvio => ({
  ...g,
  giocatori: g.giocatori.map((p) => ({ ...p })),
});

/**
 * The gold/silver groups of a proposal, as the editor's demo store holds
 * them now, with the players of the initial groups (letters by order).
 */
function gironiProposti(
  tappaId: string,
  categoria: Categoria,
  board: DemoBoard,
): { gironi: GironeAvvio[]; nonAssegnati: IscrittoFuori[] } {
  const giocatori = new Map(
    board.gironi.flatMap((g) => g.giocatori).map((p) => [p.iscrizioneId, p]),
  );
  const composizione = getDemoGironi(tappaId, categoria)?.composizione;
  const gironi = (composizione?.gironi ?? []).map((g) => ({
    id: g.id,
    nome: g.nome,
    fase: g.faseGirone,
    giocatori: g.giocatori.flatMap((p, i) => {
      const da = giocatori.get(p.iscrizioneId);
      return da ? [{ ...da, lettera: String.fromCharCode(65 + i) }] : [];
    }),
  }));
  const assegnati = new Set(
    gironi.flatMap((g) => g.giocatori.map((p) => p.iscrizioneId)),
  );
  const nonAssegnati = [...giocatori.values()]
    .filter((p) => !assegnati.has(p.iscrizioneId))
    .map(({ iscrizioneId, nome, cognome }) => ({
      iscrizioneId,
      nome,
      cognome,
    }));
  return { gironi, nonAssegnati };
}

/** One board for the start screen, or null for an unknown stage. */
export function getDemoAvvioFase(
  tappaId: string,
  categoria: Categoria,
): TabelloneAvvio | null {
  const tappa = getDemoTappaGestione(tappaId);
  if (!tappa) return null;
  const board = store().get(chiave(tappaId, categoria)) ?? {
    faseGioco: null,
    gironi: [],
    nonAssegnati: [],
  };
  const base = {
    tappa: { id: tappa.row.id, nome: tappa.row.nome, stato: tappa.row.stato },
    categoria,
    tabelloneId: chiave(tappaId, categoria),
    faseGioco: board.faseGioco,
  };
  if (board.proposta) {
    return {
      ...base,
      faseDaAvviare: "gironi_gold_silver",
      ...gironiProposti(tappaId, categoria, board),
    };
  }
  return {
    ...base,
    faseDaAvviare:
      board.faseGioco === "gironi_gold_silver" || board.faseGioco === "finali"
        ? board.faseGioco
        : "gironi_iniziali",
    gironi: board.gironi.map(copiaGirone),
    nonAssegnati: board.nonAssegnati.map((p) => ({ ...p })),
  };
}

/**
 * Every group of a demo board that has matches: the phases already played,
 * then the one in play. What the demo scores and live lists read.
 */
export function getDemoGironiGiocati(
  tappaId: string,
  categoria: Categoria,
): GironeAvvio[] {
  const board = store().get(chiave(tappaId, categoria));
  if (!board || board.faseGioco === null) return [];
  return [...(board.precedenti ?? []), ...board.gironi].map(copiaGirone);
}

/**
 * Saves a gold/silver proposal (BLVS-39, same effect as
 * `proponi_gironi_gold_silver`): its groups go to the editor's demo store,
 * unlocked, until the start.
 */
export function proponiGoldSilverDemo(
  tappaId: string,
  categoria: Categoria,
  gironi: readonly { fase: FaseGirone; nome: string; iscrizioni: string[] }[],
): boolean {
  const board = store().get(chiave(tappaId, categoria));
  if (!board || board.faseGioco !== "gironi_iniziali") return false;
  const nomi = new Map(
    board.gironi
      .flatMap((g) => g.giocatori)
      .map((p) => [p.iscrizioneId, `${p.nome} ${p.cognome}`]),
  );
  board.proposta = true;
  sostituisciDemoGironi(tappaId, categoria, (attuale) => ({
    ...attuale,
    livello: "gold_silver",
    bloccata: false,
    gironi: gironi.map((g, i) => ({
      id: `${tappaId}-${categoria}-${g.fase}-${crypto.randomUUID().slice(0, 8)}`,
      nome: g.nome,
      posizione: i + 1,
      fase: g.fase === "gold" ? "gold" : "silver",
      faseGirone: g.fase,
      giocatori: g.iscrizioni.map((id) => ({
        iscrizioneId: id,
        nome: nomi.get(id) ?? id,
      })),
    })),
    nonAssegnati: [],
  }));
  return true;
}

/**
 * Creates the finals of a demo board (same effect as `genera_finali`):
 * the gold/silver groups become played ones, the finals are in play.
 */
export function generaFinaliDemo(
  tappaId: string,
  categoria: Categoria,
  finali: readonly { fase: FaseGirone; nome: string; iscrizioni: string[] }[],
): number | null {
  const board = store().get(chiave(tappaId, categoria));
  if (!board || board.faseGioco !== "gironi_gold_silver") return null;
  const giocatori = new Map(
    board.gironi.flatMap((g) => g.giocatori).map((p) => [p.iscrizioneId, p]),
  );
  board.precedenti = [...(board.precedenti ?? []), ...board.gironi];
  board.gironi = finali.map((f) => ({
    id: `${tappaId}-${categoria}-${f.fase}`,
    nome: f.nome,
    fase: f.fase,
    giocatori: f.iscrizioni.flatMap((id, i) => {
      const da = giocatori.get(id);
      return da ? [{ ...da, lettera: String.fromCharCode(65 + i) }] : [];
    }),
  }));
  board.faseGioco = "finali";
  sostituisciDemoGironi(tappaId, categoria, (attuale) => ({
    ...attuale,
    livello: "finali",
    bloccata: true,
    gironi: board.gironi.map((g, i) => ({
      id: g.id,
      nome: g.nome,
      posizione: i + 1,
      fase: g.fase === "finale_gold" ? "gold" : "silver",
      faseGirone: g.fase,
      giocatori: g.giocatori.map((p) => ({
        iscrizioneId: p.iscrizioneId,
        nome: `${p.nome} ${p.cognome}`,
      })),
    })),
    nonAssegnati: [],
  }));
  return board.gironi.reduce((n, g) => n + partiteGirone(g).length, 0);
}

export type DemoAvvioEsito =
  | { status: "ok"; partite: number; fase: FaseGioco }
  | { status: "bloccato"; errori: ProblemaAvvio[] }
  | { status: "giaAvviata" | "nonAvviabile" | "nonTrovata" };

/** Same rules and effects as `avvia_fase`. */
export function avviaFaseDemo(
  tappaId: string,
  categoria: Categoria,
): DemoAvvioEsito {
  const tabellone = getDemoAvvioFase(tappaId, categoria);
  if (!tabellone) return { status: "nonTrovata" };
  const board = store().get(chiave(tappaId, categoria));
  const goldSilver = board?.proposta === true;
  if (tabellone.faseGioco !== null && !goldSilver) {
    return { status: "giaAvviata" };
  }
  const { stato } = tabellone.tappa;
  if (
    (stato !== "iscrizioni_chiuse" && stato !== "in_corso") ||
    (goldSilver && stato !== "in_corso")
  ) {
    return { status: "nonAvviabile" };
  }
  const errori = controllaAvvio(tabellone);
  if (errori.length > 0) return { status: "bloccato", errori };

  const partite = tabellone.gironi.reduce(
    (n, g) => n + partiteGirone(g).length,
    0,
  );
  if (board && goldSilver) {
    board.precedenti = [...(board.precedenti ?? []), ...board.gironi];
    board.gironi = tabellone.gironi;
    board.nonAssegnati = [];
    board.proposta = false;
    board.faseGioco = "gironi_gold_silver";
    sostituisciDemoGironi(tappaId, categoria, (attuale) => ({
      ...attuale,
      bloccata: true,
    }));
    return { status: "ok", partite, fase: "gironi_gold_silver" };
  }
  if (board) board.faseGioco = "gironi_iniziali";
  segnaFaseAvviataDemo(tappaId, categoria, partite);
  return { status: "ok", partite, fase: "gironi_iniziali" };
}

export const SCENARI_AVVIO = ["pronta", "bloccata"] as const;
export type ScenarioAvvio = (typeof SCENARI_AVVIO)[number];

/**
 * A stage at «iscrizioni chiuse» for one e2e test: `pronta` has M in two
 * groups of 4, `bloccata` has a group of 3, a player out of every group
 * and F with no groups. Only reachable through `POST /api/demo/avvio-fase`.
 */
/**
 * A stage at «iscrizioni chiuse» whose M board has full groups of 4, one
 * per entry of `dimensioni` (BLVS-39 e2e). Returns the stage id.
 */
export function creaDemoTappaGironi(dimensioni: number[]): string {
  const id = `e2e-${crypto.randomUUID()}`;
  aggiungiDemoTappa(id, {
    stato: "iscrizioni_chiuse",
    chiudonoIl: "2099-07-20T21:59:00Z",
    nome: `Tappa fasi ${id.slice(4, 10)}`,
    confermate: { M: dimensioni.reduce((a, b) => a + b, 0), F: 0 },
  });
  store().set(chiave(id, "M"), componi(id, "M", dimensioni));
  return id;
}

export function creaDemoAvvioFase(scenario: ScenarioAvvio): string {
  const id = `e2e-${crypto.randomUUID()}`;
  const pronta = scenario === "pronta";
  aggiungiDemoTappa(id, {
    stato: "iscrizioni_chiuse",
    chiudonoIl: "2099-07-20T21:59:00Z",
    nome: `Tappa avvio ${id.slice(4, 10)}`,
    confermate: { M: 8, F: pronta ? 4 : 0 },
  });
  store().set(
    chiave(id, "M"),
    pronta ? componi(id, "M", [4, 4]) : componi(id, "M", [4, 3], 1),
  );
  if (pronta) store().set(chiave(id, "F"), componi(id, "F", [4]));
  return id;
}

/**
 * The game phase of a demo board and the groups in play (the initial
 * ones until the gold/silver start), for BLVS-39's proposal; null when
 * the board has no groups yet.
 */
export function getDemoFaseTabellone(
  tappaId: string,
  categoria: Categoria,
): {
  faseGioco: FaseGioco | null;
  proposta: boolean;
  gironi: GironeAvvio[];
} | null {
  const board = store().get(chiave(tappaId, categoria));
  if (!board) return null;
  return {
    faseGioco: board.faseGioco,
    proposta: board.proposta === true,
    gironi: board.gironi.map(copiaGirone),
  };
}

/**
 * BLVS-43 e2e: a stage in progress whose M and F boards are both in the
 * finals (a gold and a silver final of 4 each), all to play. Returns the
 * stage id; the matches are made by w-admin-live's demo store.
 */
export function creaDemoTappaFinali(): string {
  const id = `e2e-${crypto.randomUUID()}`;
  aggiungiDemoTappa(id, {
    stato: "in_corso",
    chiudonoIl: "2099-07-20T21:59:00Z",
    nome: `Tappa finali ${id.slice(4, 10)}`,
    confermate: { M: 8, F: 8 },
  });
  for (const categoria of ["M", "F"] as const) {
    const { gironi } = componi(id, categoria, [4, 4]);
    store().set(chiave(id, categoria), {
      faseGioco: "finali",
      precedenti: [],
      nonAssegnati: [],
      gironi: gironi.map((g, i) => {
        const fase: FaseGirone = i === 0 ? "finale_gold" : "finale_silver";
        return {
          ...g,
          id: `${id}-${categoria}-${fase}`,
          nome: i === 0 ? "Finale gold" : "Finale silver",
          fase,
        };
      }),
    });
  }
  return id;
}
