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
import type { ElencoPunteggi, PartitaPunteggio } from "@/lib/punteggi/types";
import { codiceErrore, type CodiceErrore } from "@/lib/punteggi/validazione";
import { partiteGirone } from "@/lib/tappe/avvio/regole";
import {
  avviaFaseDemo,
  creaDemoAvvioFase,
  getDemoGironiGiocati,
} from "./avvio-fase";
import { getDemoTappaGestione } from "./gestione-tappe";
import { getDemoDecisioni } from "./spareggi";

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
  };
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= seed());
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
    for (const girone of getDemoGironiGiocati(tappaId, categoria)) {
      for (const p of partiteGirone(girone)) {
        const id = `${girone.id}-t${p.turno}`;
        const giocatore = (g: (typeof p.squadraA)[number]) => ({
          iscrizioneId: g.iscrizioneId,
          nome: g.nome,
          cognome: g.cognome,
        });
        partite.push({
          id,
          categoria,
          gironeId: girone.id,
          gironeNome: girone.nome,
          turno: p.turno,
          campo: null,
          ...statoDi(id),
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
    { decisioni: getDemoDecisioni(gironeId) },
  );
}

/**
 * Sets the score of a demo match directly, concluded (BLVS-39 e2e
 * fixtures). The real path is `salvaPunteggioDemo`.
 */
export function impostaPunteggioDemo(partitaId: string, set: SetPunteggio) {
  const prima = statoDi(partitaId);
  store().punteggi.set(partitaId, {
    sets: [{ ...set }],
    stato: "conclusa",
    versione: prima.versione + 1,
  });
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
