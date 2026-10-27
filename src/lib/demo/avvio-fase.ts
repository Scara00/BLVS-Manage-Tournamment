import type { Categoria, FaseGioco } from "@/lib/db/types";
import {
  assegnaLettere,
  controllaAvvio,
  partiteGirone,
  type GironeAvvio,
  type IscrittoFuori,
  type ProblemaAvvio,
  type TabelloneAvvio,
} from "@/lib/tappe/avvio/regole";
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
  gironi: GironeAvvio[];
  nonAssegnati: IscrittoFuori[];
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
  return {
    tappa: { id: tappa.row.id, nome: tappa.row.nome, stato: tappa.row.stato },
    categoria,
    tabelloneId: chiave(tappaId, categoria),
    faseGioco: board.faseGioco,
    gironi: board.gironi.map((g) => ({
      ...g,
      giocatori: g.giocatori.map((p) => ({ ...p })),
    })),
    nonAssegnati: board.nonAssegnati.map((p) => ({ ...p })),
  };
}

export type DemoAvvioEsito =
  | { status: "ok"; partite: number }
  | { status: "bloccato"; errori: ProblemaAvvio[] }
  | { status: "giaAvviata" | "nonAvviabile" | "nonTrovata" };

/** Same rules and effects as `avvia_fase`. */
export function avviaFaseDemo(
  tappaId: string,
  categoria: Categoria,
): DemoAvvioEsito {
  const tabellone = getDemoAvvioFase(tappaId, categoria);
  if (!tabellone) return { status: "nonTrovata" };
  if (tabellone.faseGioco !== null) return { status: "giaAvviata" };
  const { stato } = tabellone.tappa;
  if (stato !== "iscrizioni_chiuse" && stato !== "in_corso") {
    return { status: "nonAvviabile" };
  }
  const errori = controllaAvvio(tabellone);
  if (errori.length > 0) return { status: "bloccato", errori };

  const partite = tabellone.gironi.reduce(
    (n, g) => n + partiteGirone(g).length,
    0,
  );
  const board = store().get(chiave(tappaId, categoria));
  if (board) board.faseGioco = "gironi_iniziali";
  segnaFaseAvviataDemo(tappaId, categoria, partite);
  return { status: "ok", partite };
}

export const SCENARI_AVVIO = ["pronta", "bloccata"] as const;
export type ScenarioAvvio = (typeof SCENARI_AVVIO)[number];

/**
 * A stage at «iscrizioni chiuse» for one e2e test: `pronta` has M in two
 * groups of 4, `bloccata` has a group of 3, a player out of every group
 * and F with no groups. Only reachable through `POST /api/demo/avvio-fase`.
 */
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
