import type {
  DettaglioTappaRow,
  TabelloneTappaRow,
} from "@/lib/tappe/dettaglio";
import { demoTappeGiocatore } from "./tournament";

/**
 * Stage detail (w-tappa) for the demo, on top of the player list data:
 * meeting point, programme and cancel deadline per stage.
 */
const EXTRA: Record<
  string,
  Pick<
    DettaglioTappaRow,
    | "iscrizioni_aprono_il"
    | "ritrovo"
    | "ritrovo_alle"
    | "programma"
    | "annullabile_fino_al"
  >
> = {
  jesolo: {
    iscrizioni_aprono_il: "2026-09-01T07:00:00Z",
    ritrovo: "Piazza Mazzini, gazebo BLVS",
    ritrovo_alle: "2027-06-14T06:30:00Z",
    programma:
      "Sabato 14: gironi dalle 9:30.\nDomenica 15: eliminazione dalle 9:00, finali alle 16:00.",
    annullabile_fino_al: null,
  },
  rimini: {
    iscrizioni_aprono_il: "2026-09-01T07:00:00Z",
    ritrovo: "Bagno 26, ingresso dal lungomare",
    ritrovo_alle: "2027-06-28T06:30:00Z",
    programma:
      "Sabato 28: accrediti 8:30, gironi dalle 9:30.\nDomenica 29: eliminazione dalle 9:00, finali alle 16:00.",
    annullabile_fino_al: "2027-06-21T21:59:00Z",
  },
  cagliari: {
    iscrizioni_aprono_il: "2026-09-01T07:00:00Z",
    ritrovo: "Poetto, Ospedale Marino",
    ritrovo_alle: "2027-07-12T06:30:00Z",
    programma: null,
    annullabile_fino_al: null,
  },
  pescara: {
    iscrizioni_aprono_il: null,
    ritrovo: null,
    ritrovo_alle: null,
    programma: null,
    annullabile_fino_al: null,
  },
  lignano: {
    iscrizioni_aprono_il: null,
    ritrovo: null,
    ritrovo_alle: null,
    programma: null,
    annullabile_fino_al: null,
  },
};

/**
 * Extra stages created by the e2e fixture of w-mie-iscrizioni (BLVS-51):
 * per test, so parallel projects never share them.
 */
type DemoTappaExtra = {
  row: DettaglioTappaRow;
  posti: { categoria: "M" | "F"; posti: number; occupati: number }[];
};

const globalExtra = globalThis as typeof globalThis & {
  __blvsDemoTappeExtra?: Map<string, DemoTappaExtra>;
};

function extra(): Map<string, DemoTappaExtra> {
  globalExtra.__blvsDemoTappeExtra ??= new Map();
  return globalExtra.__blvsDemoTappeExtra;
}

/** A demo stage as `public.tappe` would return it; null when unknown. */
export function demoDettaglioTappa(id: string): DettaglioTappaRow | null {
  const aggiunta = extra().get(id);
  if (aggiunta) return { ...aggiunta.row };
  const row = demoTappeGiocatore.tappe.find((t) => t.id === id);
  if (!row) return null;
  return { ...row, ...EXTRA[row.id] };
}

/**
 * The two boards of a demo stage, as RPC `tabelloni_tappa()` returns them.
 * `presi`: seats the demo player holds on their own board (0 or 1).
 */
export function demoTabelloniTappa(id: string, presi = 0): TabelloneTappaRow[] {
  const posti =
    extra()
      .get(id)
      ?.posti.map((p) => ({ ...p, tappa_id: id, fase: null })) ??
    demoTappeGiocatore.posti.filter((p) => p.tappa_id === id);
  return posti.map((p) => {
    const own = p.categoria === demoTappeGiocatore.categoria;
    const occupati = p.occupati + (own ? presi : 0);
    return {
      categoria: p.categoria,
      posti: p.posti,
      occupati,
      prossimo_posto: occupati < p.posti ? occupati + 1 : null,
      fase: p.fase,
    };
  });
}

// ---------------------------------------------------------------------------
// Demo registrations: in memory, per browser (cookie), never shared
// ---------------------------------------------------------------------------

/** Cookie naming the demo player of this browser (no Supabase env only). */
export const DEMO_GIOCATORE_COOKIE = "blvs_demo_giocatore";

/** One demo registration: the seat and its state (ritirata once cancelled). */
export type DemoIscrizione = {
  tappaId: string;
  posto: number;
  stato: "in_attesa" | "ritirata";
};

type DemoStore = Map<string, Map<string, DemoIscrizione>>;

const globalStore = globalThis as typeof globalThis & {
  __blvsDemoIscrizioni?: DemoStore;
};

function store(): DemoStore {
  globalStore.__blvsDemoIscrizioni ??= new Map();
  return globalStore.__blvsDemoIscrizioni;
}

/** The demo player's registration to this stage (active or cancelled). */
export function demoIscrizione(
  giocatore: string | undefined,
  tappaId: string,
): DemoIscrizione | null {
  if (!giocatore) return null;
  return store().get(giocatore)?.get(tappaId) ?? null;
}

/** The seat the demo player holds at this stage, if the registration is active. */
export function demoPostoPreso(
  giocatore: string | undefined,
  tappaId: string,
): number | null {
  const iscrizione = demoIscrizione(giocatore, tappaId);
  return iscrizione?.stato === "in_attesa" ? iscrizione.posto : null;
}

/** Every registration of the demo player, cancelled ones included. */
export function demoIscrizioniGiocatore(
  giocatore: string | undefined,
): DemoIscrizione[] {
  if (!giocatore) return [];
  return [...(store().get(giocatore)?.values() ?? [])];
}

/**
 * Takes the next seat for the demo player. Other browsers' demo
 * registrations don't count, so parallel e2e runs never fill a board. A
 * cancelled registration is replaced, as `iscriviti_tappa()` does.
 */
export function demoPrendiPosto(giocatore: string, tappaId: string): number {
  const [own] = demoTabelloniTappa(tappaId).filter(
    (b) => b.categoria === demoTappeGiocatore.categoria,
  );
  const posto = own?.prossimo_posto ?? 1;
  const mine = store().get(giocatore) ?? new Map<string, DemoIscrizione>();
  mine.set(tappaId, { tappaId, posto, stato: "in_attesa" });
  store().set(giocatore, mine);
  return posto;
}

/**
 * Cancels the demo player's registration: the seat is free again (the
 * board counters no longer include it). Returns the freed seat, or null
 * when there was no active registration.
 */
export function demoAnnullaPosto(
  giocatore: string | undefined,
  tappaId: string,
): number | null {
  const iscrizione = demoIscrizione(giocatore, tappaId);
  if (!iscrizione || iscrizione.stato !== "in_attesa") return null;
  iscrizione.stato = "ritirata";
  return iscrizione.posto;
}

const GIORNO_MS = 86_400_000;

function giorno(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * e2e fixture of w-mie-iscrizioni: two stages the demo player is already
 * registered to. `annullabile` can still be cancelled (deadline in 30
 * days); `scaduta` has its cancel deadline behind `at` but has not started.
 */
export function creaDemoMieIscrizioni(
  giocatore: string,
  at: Date,
): { annullabile: string; scaduta: string } {
  const base = at.getTime();
  const crea = (
    nome: string,
    {
      stato,
      annullabileFino,
      inizio,
    }: {
      stato: DettaglioTappaRow["stato"];
      annullabileFino: number;
      inizio: number;
    },
  ) => {
    const id = `e2e-mie-${crypto.randomUUID()}`;
    extra().set(id, {
      row: {
        id,
        nome,
        luogo: "Spiaggia di prova",
        data_inizio: giorno(inizio),
        data_fine: giorno(inizio + GIORNO_MS),
        stato,
        iscrizioni_aprono_il: null,
        iscrizioni_chiudono_il: new Date(annullabileFino).toISOString(),
        ritrovo: null,
        ritrovo_alle: null,
        programma: null,
        annullabile_fino_al: new Date(annullabileFino).toISOString(),
      },
      posti: [
        { categoria: "M", posti: 16, occupati: 9 },
        { categoria: "F", posti: 16, occupati: 6 },
      ],
    });
    demoPrendiPosto(giocatore, id);
    return id;
  };
  return {
    annullabile: crea("Tappa di prova · Sabaudia", {
      stato: "iscrizioni_aperte",
      annullabileFino: base + 30 * GIORNO_MS,
      inizio: base + 40 * GIORNO_MS,
    }),
    scaduta: crea("Tappa di prova · Sottomarina", {
      stato: "iscrizioni_chiuse",
      annullabileFino: base - GIORNO_MS,
      inizio: base + 10 * GIORNO_MS,
    }),
  };
}
