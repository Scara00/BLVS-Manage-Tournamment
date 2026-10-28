import type { Categoria } from "@/lib/db/types";
import type {
  ImpattoFase,
  SceltaImpatto,
} from "@/lib/punteggi/correzione/types";
import { nomeGiocatore } from "@/lib/ritiri/anteprima";
import { REGOLA_RITIRO } from "@/lib/ritiri/regola";
import type { AssenzaRegistrata } from "@/lib/ritiri/types";
import type { DatiRitiro } from "@/lib/ritiri/validazione";
import { chiaveTabellone } from "@/lib/tappe/live-admin/types";
import { now } from "@/lib/time/server-time";
import { annullaPartitaDemo, getDemoTabelloneLive } from "./admin-live";
import {
  annullaPartitaPunteggiDemo,
  creaDemoPunteggi,
  eliminaFaseSuccessivaDemo,
  faseSuccessivaDemo,
  getDemoPunteggi,
  impostaFaseSuccessivaDemo,
} from "./punteggi";
import { aggiungiVoceDemoRegistro } from "./registro";

/**
 * Withdrawals and absences recorded on the demo boards (BLVS-42), like
 * `assenze_partita`. One server instance, reset on restart, like the other
 * demo stores.
 */
type Store = Map<string, AssenzaRegistrata[]>;

const STORE_KEY = Symbol.for("blvs.demo.ritiri");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

/** The absences recorded on one demo board. */
export function getDemoAssenze(
  tappaId: string,
  categoria: Categoria,
): AssenzaRegistrata[] {
  return [...(store().get(chiaveTabellone(tappaId, categoria)) ?? [])];
}

export type DemoRitiroEsito =
  | {
      status: "ok";
      nome: string;
      partite: number;
      scelta: SceltaImpatto | null;
      punteggiPersi: number;
    }
  | {
      status: "impatto" | "confermaRichiesta" | "impattoCambiato";
      impatto: ImpattoFase;
    }
  | {
      status:
        | "estranea"
        | "annullata"
        | "giaRegistrata"
        | "versioneSuperata"
        | "nonRegistrabile"
        | "nonTrovata";
    };

/** Same checks and effects as `registra_ritiro_assenza` («annulla» rule). */
export function registraRitiroDemo(
  tappaId: string,
  categoria: Categoria,
  dati: DatiRitiro,
  {
    scelta = null,
    conferma = false,
    attesi = null,
  }: {
    scelta?: SceltaImpatto | null;
    conferma?: boolean;
    attesi?: number | null;
  } = {},
): DemoRitiroEsito {
  const tabellone = getDemoTabelloneLive(tappaId, categoria, now());
  if (!tabellone) return { status: "nonTrovata" };
  if (tabellone.tappa.stato !== "in_corso")
    return { status: "nonRegistrabile" };
  const chiave = chiaveTabellone(tappaId, categoria);
  const assenze = store().get(chiave) ?? [];

  const ids = new Set(dati.partite.map((p) => p.partitaId));
  if (ids.size !== dati.partite.length) return { status: "estranea" };
  let nome: string | null = null;
  for (const { partitaId, versione } of dati.partite) {
    const partita = tabellone.partite.find((p) => p.id === partitaId);
    const giocatore = partita
      ? [...partita.squadraA, ...partita.squadraB].find(
          (g) => g.iscrizioneId === dati.iscrizioneId,
        )
      : undefined;
    if (!partita || !giocatore) return { status: "estranea" };
    nome = nomeGiocatore(giocatore);
    if (partita.stato === "annullata") return { status: "annullata" };
    if (
      assenze.some(
        (a) =>
          a.partitaId === partitaId && a.iscrizioneId === dati.iscrizioneId,
      )
    ) {
      return { status: "giaRegistrata" };
    }
    if (partita.versione !== versione) return { status: "versioneSuperata" };
  }

  // The demo next phase is per board (BLVS-41's store).
  const impatto = getDemoPunteggi(tappaId)
    ? faseSuccessivaDemo(tappaId, dati.partite[0].partitaId)
    : null;
  if (impatto) {
    if (!scelta) return { status: "impatto", impatto };
    if (attesi !== impatto.punteggiPersi) {
      return { status: "impattoCambiato", impatto };
    }
    if (scelta === "rigenera" && impatto.punteggiPersi > 0 && !conferma) {
      return { status: "confermaRichiesta", impatto };
    }
  }

  const righe = dati.partite.map(({ partitaId }) => {
    const prima = tabellone.partite.find((p) => p.id === partitaId)!;
    annullaPartitaDemo(tappaId, categoria, partitaId);
    annullaPartitaPunteggiDemo(partitaId);
    return {
      partita_id: partitaId,
      girone: prima.gironeNome,
      turno: prima.turno,
      sets: prima.sets,
      stato: prima.stato,
    };
  });
  store().set(chiave, [
    ...assenze,
    ...dati.partite.map((p) => ({
      partitaId: p.partitaId,
      iscrizioneId: dati.iscrizioneId,
      tipo: dati.tipo,
    })),
  ]);
  if (impatto && scelta === "rigenera") {
    eliminaFaseSuccessivaDemo(tappaId, categoria);
  }

  const giocatore = nome ?? dati.iscrizioneId;
  aggiungiVoceDemoRegistro(tappaId, {
    tipo: dati.tipo,
    autore: "Amministrazione demo",
    prima: { tappa_id: tappaId, giocatore, partite: righe },
    dopo: {
      tappa_id: tappaId,
      giocatore,
      regola: {
        esito: REGOLA_RITIRO.esito,
        vincitore: REGOLA_RITIRO.puntiVincitore,
        perdente: REGOLA_RITIRO.puntiPerdente,
      },
      partite: righe.map((r) => ({ ...r, sets: [], stato: "annullata" })),
    },
    nota: `${dati.tipo === "ritiro" ? "Ritiro" : "Assenza"} di ${giocatore}`,
  });
  return {
    status: "ok",
    nome: giocatore,
    partite: righe.length,
    scelta: impatto ? scelta : null,
    punteggiPersi: impatto && scelta === "rigenera" ? impatto.punteggiPersi : 0,
  };
}

/**
 * BLVS-42's e2e stage: the men's board started (two groups), and with
 * `faseSuccessiva` a generated next phase with one scored final. Only
 * reachable through `POST /api/demo/ritiro`.
 */
export function creaDemoRitiro(faseSuccessiva = false): {
  id: string;
  gironeId: string;
} {
  const id = creaDemoPunteggi();
  const tabellone = getDemoTabelloneLive(id, "M", now());
  const prima = tabellone?.partite[0];
  if (faseSuccessiva && prima) {
    const nome = (g: { nome: string; cognome: string }) =>
      `${g.nome} ${g.cognome}`.trim();
    impostaFaseSuccessivaDemo(id, "M", [
      {
        id: `${id}-M-finale-1`,
        fase: "finale",
        girone: "Finale gold",
        turno: 1,
        stato: "conclusa",
        sets: [{ a: 21, b: 19 }],
        squadre: { a: prima.squadraA.map(nome), b: prima.squadraB.map(nome) },
      },
    ]);
  }
  return { id, gironeId: prima?.gironeId ?? "" };
}
