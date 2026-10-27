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

/** A demo stage as `public.tappe` would return it; null when unknown. */
export function demoDettaglioTappa(id: string): DettaglioTappaRow | null {
  const row = demoTappeGiocatore.tappe.find((t) => t.id === id);
  if (!row) return null;
  return { ...row, ...EXTRA[row.id] };
}

/** The two boards of a demo stage, as RPC `tabelloni_tappa()` returns them. */
export function demoTabelloniTappa(id: string, presi = 0): TabelloneTappaRow[] {
  return demoTappeGiocatore.posti
    .filter((p) => p.tappa_id === id)
    .map((p) => {
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

type DemoStore = Map<string, Map<string, number>>;

const globalStore = globalThis as typeof globalThis & {
  __blvsDemoIscrizioni?: DemoStore;
};

function store(): DemoStore {
  globalStore.__blvsDemoIscrizioni ??= new Map();
  return globalStore.__blvsDemoIscrizioni;
}

/** The seat the demo player took at this stage, if any. */
export function demoPostoPreso(
  giocatore: string | undefined,
  tappaId: string,
): number | null {
  if (!giocatore) return null;
  return store().get(giocatore)?.get(tappaId) ?? null;
}

/**
 * Takes the next seat for the demo player. Other browsers' demo
 * registrations don't count, so parallel e2e runs never fill a board.
 */
export function demoPrendiPosto(giocatore: string, tappaId: string): number {
  const [own] = demoTabelloniTappa(tappaId).filter(
    (b) => b.categoria === demoTappeGiocatore.categoria,
  );
  const posto = own?.prossimo_posto ?? 1;
  const mine = store().get(giocatore) ?? new Map<string, number>();
  mine.set(tappaId, posto);
  store().set(giocatore, mine);
  return posto;
}
