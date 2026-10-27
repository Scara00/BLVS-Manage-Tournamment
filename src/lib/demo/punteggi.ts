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
    parziali: new Map(),
  };
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  const s = (g[STORE_KEY] ??= seed());
  // A store created by an older build (dev server reload) lacks it.
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
  | { status: "ok"; versione: number; tipo: "inserimento" | "correzione" }
  | { status: "nonValido"; codice: CodiceErrore }
  | { status: "versioneSuperata" | "nonGiocabile" | "nonTrovata" };

/** Same rules and effects as `salva_punteggio`. */
export function salvaPunteggioDemo(
  tappaId: string,
  partitaId: string,
  versione: number,
  punti: SetPunteggio,
  at: number,
): DemoSalvaEsito {
  const elenco = getDemoPunteggi(tappaId);
  const partita = elenco?.partite.find((p) => p.id === partitaId);
  if (!elenco || !partita) return { status: "nonTrovata" };
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
  // Like the `partite_cancella_parziale` trigger: the match left in_corso.
  store().parziali.delete(partitaId);
  return {
    status: "ok",
    versione: dopo.versione,
    tipo: correzione ? "correzione" : "inserimento",
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
 * The same stage with its first match (men's Girone A, round 1, with the
 * demo player) already started, so it accepts a partial (BLVS-37).
 */
export function creaDemoPartitaInCorso(): { id: string; partitaId: string } {
  const id = creaDemoPunteggi();
  const partitaId = getDemoPunteggi(id)!.partite[0].id;
  iniziaPartitaDemo(partitaId);
  return { id, partitaId };
}
