import {
  CATEGORIE,
  type SetPunteggio,
  type StatoPartita,
} from "@/lib/db/types";
import {
  classificaGirone,
  type ClassificaGirone,
} from "@/lib/gironi/classifica";
import type { PunteggioUfficiale } from "@/lib/punteggi/conflitto/rileva";
import type {
  ImpattoFase,
  PartitaFaseSuccessiva,
  SceltaImpatto,
} from "@/lib/punteggi/correzione/types";
import { FINESTRA_ANNULLAMENTO_SECONDI } from "@/lib/punteggi/regola";
import type {
  ElencoPunteggi,
  ParzialePartita,
  PartitaPunteggio,
} from "@/lib/punteggi/types";
import { codiceErrore, type CodiceErrore } from "@/lib/punteggi/validazione";
import { partiteGirone } from "@/lib/tappe/avvio/regole";
import {
  avviaFaseDemo,
  creaDemoAvvioFase,
  getDemoAvvioFase,
} from "./avvio-fase";
import { getDemoTappaGestione } from "./gestione-tappe";

/**
 * Scores of the demo group matches when Supabase is not configured (CI,
 * e2e). The matches are those of the started demo boards (BLVS-29's store);
 * this keeps only what `punteggi` would hold, plus the last save so
 * «Annulla» follows the same rules as `annulla_punteggio`.
 * One server instance, reset on restart, like the other demo stores.
 */
type StatoDemo = {
  sets: SetPunteggio[];
  stato: StatoPartita;
  versione: number;
};

type Salvataggio = { prima: StatoDemo; versione: number; at: number };

type Store = {
  punteggi: Map<string, StatoDemo>;
  ultimi: Map<string, Salvataggio | "annullato">;
  /** BLVS-41: next-phase matches per board (`<tappa>:<M|F>`). */
  successive: Map<string, PartitaFaseSuccessiva[]>;
  /** BLVS-37: the partial of a match in progress, like `punteggi_parziali`. */
  parziali: Map<string, ParzialePartita>;
};

const STORE_KEY = Symbol.for("blvs.demo.punteggi");

function seed(): Store {
  return {
    // Jesolo is in progress: the first match of the men's Girone A is done.
    punteggi: new Map([
      [
        "jesolo-M-g1-t1",
        { sets: [{ a: 21, b: 17 }], stato: "conclusa", versione: 2 },
      ],
    ]),
    ultimi: new Map(),
    successive: new Map(),
    parziali: new Map(),
  };
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  const s = (g[STORE_KEY] ??= seed());
  // A store created by an older server instance (hot reload) lacks them.
  s.successive ??= new Map();
  s.parziali ??= new Map();
  return s;
}

function parzialeDi(id: string, stato: StatoPartita): ParzialePartita | null {
  const p = stato === "in_corso" ? store().parziali.get(id) : undefined;
  return p ? { ...p } : null;
}

function statoDi(id: string): StatoDemo {
  const s = store().punteggi.get(id);
  return s
    ? {
        sets: s.sets.map((x) => ({ ...x })),
        stato: s.stato,
        versione: s.versione,
      }
    : { sets: [], stato: "programmata", versione: 1 };
}

/** Every group match of a stage, or null for an unknown stage. */
export function getDemoPunteggi(tappaId: string): ElencoPunteggi | null {
  const tappa = getDemoTappaGestione(tappaId);
  if (!tappa) return null;
  const partite: PartitaPunteggio[] = [];
  for (const categoria of CATEGORIE) {
    const board = getDemoAvvioFase(tappaId, categoria);
    if (!board || board.faseGioco === null) continue;
    for (const girone of board.gironi) {
      for (const p of partiteGirone(girone)) {
        const id = `${girone.id}-t${p.turno}`;
        const giocatore = (g: (typeof p.squadraA)[number]) => ({
          iscrizioneId: g.iscrizioneId,
          nome: g.nome,
          cognome: g.cognome,
        });
        const stato = statoDi(id);
        partite.push({
          id,
          categoria,
          gironeId: girone.id,
          gironeNome: girone.nome,
          turno: p.turno,
          campo: null,
          ...stato,
          parziale: parzialeDi(id, stato.stato),
          squadre: {
            a: p.squadraA.map(giocatore),
            b: p.squadraB.map(giocatore),
          },
        });
      }
    }
  }
  return {
    tappa: { id: tappa.row.id, nome: tappa.row.nome, stato: tappa.row.stato },
    partite,
  };
}

export type DemoSalvaEsito =
  | {
      status: "ok";
      versione: number;
      tipo: "inserimento" | "correzione";
      scelta: SceltaImpatto | null;
      punteggiPersi: number;
    }
  | { status: "nonValido"; codice: CodiceErrore }
  | {
      status: "impatto" | "confermaRichiesta" | "impattoCambiato";
      impatto: ImpattoFase;
    }
  | { status: "versioneSuperata" | "nonGiocabile" | "nonTrovata" };

export type DemoOpzioniImpatto = {
  scelta?: SceltaImpatto | null;
  conferma?: boolean;
  attesi?: number | null;
};

function chiaveBoard(tappaId: string, categoria: string) {
  return `${tappaId}:${categoria}`;
}

function impattoDi(partite: readonly PartitaFaseSuccessiva[]): ImpattoFase {
  return {
    partite: partite.map((p) => ({
      ...p,
      sets: p.sets.map((x) => ({ ...x })),
    })),
    punteggiPersi: partite.filter((p) => p.sets.length > 0).length,
  };
}

/**
 * The next phase a correction of `partitaId` would affect, like
 * `fase_successiva_correzione`; null when the board has none.
 */
export function faseSuccessivaDemo(
  tappaId: string,
  partitaId: string,
): ImpattoFase | null {
  const partita = getDemoPunteggi(tappaId)?.partite.find(
    (p) => p.id === partitaId,
  );
  if (!partita) return null;
  const partite = store().successive.get(
    chiaveBoard(tappaId, partita.categoria),
  );
  return partite && partite.length > 0 ? impattoDi(partite) : null;
}

/** e2e/Storybook: sets the next phase of a demo board. */
export function impostaFaseSuccessivaDemo(
  tappaId: string,
  categoria: string,
  partite: PartitaFaseSuccessiva[],
) {
  store().successive.set(chiaveBoard(tappaId, categoria), partite);
}

/**
 * Same rules and effects as `correggi_punteggio`, which wraps
 * `salva_punteggio`: with a next phase the save waits for a choice.
 */
export function salvaPunteggioDemo(
  tappaId: string,
  partitaId: string,
  versione: number,
  punti: SetPunteggio,
  at: number,
  { scelta = null, conferma = false, attesi = null }: DemoOpzioniImpatto = {},
): DemoSalvaEsito {
  const elenco = getDemoPunteggi(tappaId);
  const partita = elenco?.partite.find((p) => p.id === partitaId);
  if (!elenco || !partita) return { status: "nonTrovata" };
  const impatto = faseSuccessivaDemo(tappaId, partitaId);
  if (impatto) {
    if (!scelta) return { status: "impatto", impatto };
    if (attesi !== impatto.punteggiPersi) {
      return { status: "impattoCambiato", impatto };
    }
    if (scelta === "rigenera" && impatto.punteggiPersi > 0 && !conferma) {
      return { status: "confermaRichiesta", impatto };
    }
  }
  if (elenco.tappa.stato !== "in_corso" || partita.stato === "annullata") {
    return { status: "nonGiocabile" };
  }
  const codice = codiceErrore(punti.a, punti.b);
  if (codice) return { status: "nonValido", codice };
  if (partita.versione !== versione) return { status: "versioneSuperata" };

  const prima = statoDi(partitaId);
  const correzione = prima.stato === "conclusa" && prima.sets.length > 0;
  const dopo: StatoDemo = {
    sets: [{ a: punti.a, b: punti.b }],
    stato: "conclusa",
    versione: versione + 1,
  };
  store().punteggi.set(partitaId, dopo);
  store().ultimi.set(partitaId, { prima, versione: dopo.versione, at });
  // «Rigenera»: the next phase goes; BLVS-39's generator is not in the
  // demo yet, so it stays empty until it is generated again.
  if (impatto && scelta === "rigenera") {
    store().successive.delete(chiaveBoard(tappaId, partita.categoria));
  }
  // Like the `partite_cancella_parziale` trigger: the match left in_corso.
  store().parziali.delete(partitaId);
  return {
    status: "ok",
    versione: dopo.versione,
    tipo: correzione ? "correzione" : "inserimento",
    scelta: impatto ? scelta : null,
    punteggiPersi: impatto && scelta === "rigenera" ? impatto.punteggiPersi : 0,
  };
}

/**
 * The official score of a demo match, like `punteggio_attuale` (BLVS-34).
 * The demo has no authors: `autore` is null; the time is the last save's.
 */
export function punteggioUfficialeDemo(
  tappaId: string,
  partitaId: string,
): PunteggioUfficiale | null {
  const partita = getDemoPunteggi(tappaId)?.partite.find(
    (p) => p.id === partitaId,
  );
  if (!partita) return null;
  const ultimo = store().ultimi.get(partitaId);
  return {
    versione: partita.versione,
    sets: partita.sets,
    autore: null,
    salvatoIl:
      ultimo && ultimo !== "annullato"
        ? new Date(ultimo.at).toISOString()
        : null,
  };
}

export type DemoAnnullaEsito =
  | { status: "ok"; versione: number }
  | { status: "cambiato" | "scaduto" | "nonTrovata" };

/** Same rules and effects as `annulla_punteggio`. */
export function annullaPunteggioDemo(
  tappaId: string,
  partitaId: string,
  versione: number,
  at: number,
): DemoAnnullaEsito {
  const partita = getDemoPunteggi(tappaId)?.partite.find(
    (p) => p.id === partitaId,
  );
  if (!partita) return { status: "nonTrovata" };
  const ultimo = store().ultimi.get(partitaId);
  if (
    !ultimo ||
    ultimo === "annullato" ||
    ultimo.versione !== versione ||
    partita.versione !== versione
  ) {
    return { status: "cambiato" };
  }
  if (at - ultimo.at > FINESTRA_ANNULLAMENTO_SECONDI * 1000) {
    return { status: "scaduto" };
  }
  store().punteggi.set(partitaId, {
    ...ultimo.prima,
    versione: versione + 1,
  });
  store().ultimi.set(partitaId, "annullato");
  return { status: "ok", versione: versione + 1 };
}

/** The standing of a demo group, computed like BLVS-27's on read. */
export function classificaDemo(
  tappaId: string,
  gironeId: string,
): ClassificaGirone | null {
  const partite = getDemoPunteggi(tappaId)?.partite.filter(
    (p) => p.gironeId === gironeId,
  );
  if (!partite || partite.length === 0) return null;
  const iscrizioni = [
    ...new Set(
      partite.flatMap((p) =>
        [...p.squadre.a, ...p.squadre.b].map((g) => g.iscrizioneId),
      ),
    ),
  ].sort();
  return classificaGirone(
    iscrizioni,
    partite.map((p) => ({
      id: p.id,
      stato: p.stato,
      squadre: {
        A: p.squadre.a.map((g) => g.iscrizioneId),
        B: p.squadre.b.map((g) => g.iscrizioneId),
      },
      sets: p.sets,
    })),
  );
}

export type DemoParzialeEsito =
  | { status: "ok"; versione: number; aggiornatoIl: string }
  | { status: "versioneSuperata" | "nonInCorso" | "nonValido" | "nonTrovata" };

/** Same rules and effects as `salva_parziale` (BLVS-37). */
export function salvaParzialeDemo(
  tappaId: string,
  partitaId: string,
  versione: number,
  punti: SetPunteggio,
  at: number,
): DemoParzialeEsito {
  const elenco = getDemoPunteggi(tappaId);
  const partita = elenco?.partite.find((p) => p.id === partitaId);
  if (!elenco || !partita) return { status: "nonTrovata" };
  if (elenco.tappa.stato !== "in_corso" || partita.stato !== "in_corso") {
    return { status: "nonInCorso" };
  }
  const valido = (n: number) => Number.isInteger(n) && n >= 0 && n <= 99;
  if (!valido(punti.a) || !valido(punti.b)) return { status: "nonValido" };
  if ((partita.parziale?.versione ?? 0) !== versione) {
    return { status: "versioneSuperata" };
  }
  const aggiornatoIl = new Date(at).toISOString();
  store().parziali.set(partitaId, {
    a: punti.a,
    b: punti.b,
    versione: versione + 1,
    aggiornatoIl,
  });
  return { status: "ok", versione: versione + 1, aggiornatoIl };
}

/** The current partial of a demo match, like `parziale_attuale`. */
export function parzialeAttualeDemo(
  tappaId: string,
  partitaId: string,
): ParzialePartita | null | undefined {
  const partita = getDemoPunteggi(tappaId)?.partite.find(
    (p) => p.id === partitaId,
  );
  return partita ? (partita.parziale ?? null) : undefined;
}

/** BLVS-31's «Inizia» on a demo match: it goes `in_corso`. */
export function iniziaPartitaDemo(partitaId: string) {
  const prima = statoDi(partitaId);
  if (prima.stato !== "programmata") return;
  store().punteggi.set(partitaId, { ...prima, stato: "in_corso" });
}

/**
 * A stage in progress whose men's board has two started groups, for one
 * e2e test. Only reachable through `POST /api/demo/inserimento-punteggio`.
 */
export function creaDemoPunteggi(): string {
  const id = creaDemoAvvioFase("pronta");
  avviaFaseDemo(id, "M");
  return id;
}

/**
 * BLVS-41's e2e stage: the men's board with every group match concluded
 * and a next phase of two finals, `punteggi` of them (0–2) already scored.
 * Only reachable through `POST /api/demo/correzione-punteggio`.
 */
export function creaDemoCorrezione(punteggi = 1): string {
  const id = creaDemoPunteggi();
  const elenco = getDemoPunteggi(id);
  if (!elenco) return id;
  const risultati: SetPunteggio[] = [
    { a: 21, b: 18 },
    { a: 21, b: 15 },
    { a: 17, b: 21 },
  ];
  for (const p of elenco.partite) {
    const set = risultati[(p.turno - 1) % risultati.length];
    store().punteggi.set(p.id, {
      sets: [{ ...set }],
      stato: "conclusa",
      versione: 2,
    });
  }
  const nome = (g: { nome: string; cognome: string }) =>
    `${g.nome} ${g.cognome}`.trim();
  const finali = elenco.partite
    .filter((p) => p.categoria === "M" && p.turno === 1)
    .slice(0, 2)
    .map((p, i): PartitaFaseSuccessiva => ({
      id: `${id}-M-finale-${i + 1}`,
      fase: "finale",
      turno: i + 1,
      stato: i < punteggi ? "conclusa" : "programmata",
      sets: i < punteggi ? [{ a: 21, b: 19 }] : [],
      squadre: {
        a: p.squadre.a.map(nome),
        b: p.squadre.b.map(nome),
      },
    }));
  impostaFaseSuccessivaDemo(id, "M", finali);
  return id;
}

/**
 * The same stage with its first match (men's Girone A, round 1, with the
 * demo player) already started, so it accepts a partial (BLVS-37).
 */
export function creaDemoPartitaInCorso(): { id: string; partitaId: string } {
  const id = creaDemoPunteggi();
  const partitaId = getDemoPunteggi(id)!.partite[0].id;
  iniziaPartitaDemo(partitaId);
  return { id, partitaId };
}
