import type { StatoTappa } from "@/lib/db/types";
import type {
  TabelloneRow,
  TappaGestioneRow,
} from "@/lib/tappe/gestione-format";
import { isTransizionePermessa, requisitoApertura } from "@/lib/tappe/stato";

/**
 * In-memory stages for the management page when Supabase is not configured
 * (CI, e2e), like the live bus: one server instance, reset on restart. It
 * applies the same rules as the trigger `tappe_controlla_stato`.
 */
export type DemoTappaGestione = {
  row: TappaGestioneRow;
  tabelloni: TabelloneRow[];
  /** Maximum per board; the default (16) when missing. */
  posti?: number;
};

type Store = Map<string, DemoTappaGestione>;

const STORE_KEY = Symbol.for("blvs.demo.gestioneTappe");

function board(
  categoria: "M" | "F",
  confermate: number,
  inAttesa: number,
  fasiPartite: string[] = [],
): TabelloneRow {
  return { categoria, confermate, inAttesa, fasiPartite };
}

function seed(): Store {
  const tappe: DemoTappaGestione[] = [
    {
      row: {
        id: "jesolo",
        nome: "Tappa 1 · Jesolo",
        luogo: "Jesolo Lido, Piazza Mazzini",
        data_inizio: "2027-06-12",
        data_fine: "2027-06-13",
        stato: "in_corso",
        iscrizioni_aprono_il: "2027-05-01T07:00:00Z",
        iscrizioni_chiudono_il: "2027-06-05T21:59:00Z",
        iscrizioni_chiuse_il: "2027-06-05T21:59:30Z",
        chiusura_automatica: true,
      },
      tabelloni: [board("M", 16, 0, ["gironi"]), board("F", 12, 0, ["gironi"])],
    },
    {
      row: {
        id: "rimini",
        nome: "Tappa 2 · Rimini",
        luogo: "Rimini, Bagno 26",
        data_inizio: "2027-06-26",
        data_fine: "2027-06-27",
        stato: "iscrizioni_aperte",
        iscrizioni_aprono_il: "2027-05-15T07:00:00Z",
        iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
        iscrizioni_chiuse_il: null,
        chiusura_automatica: false,
      },
      tabelloni: [board("M", 9, 3), board("F", 7, 2)],
    },
    {
      row: {
        id: "cagliari",
        nome: "Tappa 3 · Cagliari",
        luogo: "Cagliari, Poetto",
        data_inizio: "2027-07-10",
        data_fine: "2027-07-11",
        stato: "iscrizioni_chiuse",
        iscrizioni_aprono_il: "2027-05-20T07:00:00Z",
        iscrizioni_chiudono_il: "2027-07-03T21:59:00Z",
        iscrizioni_chiuse_il: "2027-07-03T22:00:00Z",
        chiusura_automatica: true,
      },
      tabelloni: [board("M", 14, 0), board("F", 8, 0)],
    },
    {
      row: {
        id: "bari",
        nome: "Tappa 4 · Bari",
        luogo: "Bari, Pane e Pomodoro",
        data_inizio: "2027-07-31",
        data_fine: "2027-08-01",
        stato: "bozza",
        iscrizioni_aprono_il: null,
        iscrizioni_chiudono_il: "2027-07-24T21:59:00Z",
        iscrizioni_chiuse_il: null,
        chiusura_automatica: false,
      },
      tabelloni: [board("M", 0, 0), board("F", 0, 0)],
    },
  ];
  return new Map(tappe.map((t) => [t.row.id, t]));
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= seed());
}

function copy(tappa: DemoTappaGestione): DemoTappaGestione {
  return {
    ...tappa,
    row: { ...tappa.row },
    tabelloni: tappa.tabelloni.map((t) => ({ ...t })),
  };
}

/** Same as `chiudi_iscrizioni_scadute()`: returns how many it closed. */
export function chiudiDemoScadute(at: Date): number {
  let chiuse = 0;
  for (const { row } of store().values()) {
    if (
      row.stato === "iscrizioni_aperte" &&
      row.iscrizioni_chiudono_il &&
      new Date(row.iscrizioni_chiudono_il).getTime() <= at.getTime()
    ) {
      row.stato = "iscrizioni_chiuse";
      row.iscrizioni_chiuse_il = at.toISOString();
      row.chiusura_automatica = true;
      chiuse += 1;
    }
  }
  return chiuse;
}

export function listDemoTappeGestione(): DemoTappaGestione[] {
  return [...store().values()]
    .map(copy)
    .sort((a, b) => a.row.data_inizio.localeCompare(b.row.data_inizio));
}

export function getDemoTappaGestione(id: string): DemoTappaGestione | null {
  const tappa = store().get(id);
  return tappa ? copy(tappa) : null;
}

/**
 * BLVS-25: the registrants store (`iscritti-admin.ts`) writes back the
 * counts of a board after an add or a removal, so every page agrees.
 */
export function aggiornaContiDemo(
  id: string,
  categoria: "M" | "F",
  conti: { confermate: number; inAttesa: number },
): void {
  const board = store()
    .get(id)
    ?.tabelloni.find((t) => t.categoria === categoria);
  if (!board) return;
  board.confermate = conti.confermate;
  board.inAttesa = conti.inAttesa;
}

export type DemoEsito =
  | "ok"
  | "nonTrovata"
  | "conflitto"
  | "transizioneNonPermessa"
  | "scadenzaMancante";

export function cambiaStatoDemo(
  id: string,
  da: StatoTappa,
  a: StatoTappa,
  at: Date,
): DemoEsito {
  const tappa = store().get(id);
  if (!tappa) return "nonTrovata";
  const { row } = tappa;
  if (row.stato !== da) return "conflitto";
  if (!isTransizionePermessa(da, a)) return "transizioneNonPermessa";
  if (
    a === "iscrizioni_aperte" &&
    requisitoApertura(
      row.iscrizioni_chiudono_il ? new Date(row.iscrizioni_chiudono_il) : null,
      at,
    )
  ) {
    return "scadenzaMancante";
  }
  row.stato = a;
  if (a === "iscrizioni_chiuse") {
    row.iscrizioni_chiuse_il = at.toISOString();
    row.chiusura_automatica = false;
  }
  return "ok";
}

export function aggiornaScadenzaDemo(id: string, chiudonoIl: Date): DemoEsito {
  const tappa = store().get(id);
  if (!tappa) return "nonTrovata";
  if (tappa.row.stato !== "bozza" && tappa.row.stato !== "iscrizioni_aperte") {
    return "conflitto";
  }
  tappa.row.iscrizioni_chiudono_il = chiudonoIl.toISOString();
  return "ok";
}

/**
 * The group phase of one board started (BLVS-29): like `avvia_fase`, the
 * board gets its group matches and a stage `iscrizioni_chiuse` moves to
 * `in_corso`.
 */
export function segnaFaseAvviataDemo(
  id: string,
  categoria: "M" | "F",
  partite: number,
): DemoEsito {
  const tappa = store().get(id);
  if (!tappa) return "nonTrovata";
  const tabellone = tappa.tabelloni.find((t) => t.categoria === categoria);
  if (!tabellone) return "nonTrovata";
  tabellone.fasiPartite = [
    ...tabellone.fasiPartite.filter((f) => f !== "gironi"),
    ...Array.from({ length: partite }, () => "gironi"),
  ];
  if (tappa.row.stato === "iscrizioni_chiuse") tappa.row.stato = "in_corso";
  return "ok";
}

/**
 * Adds a stage for one e2e test, so parallel projects never share it.
 * Only reachable through the demo-only route `POST /api/demo/tappe`.
 */
export function creaDemoTappa({
  stato = "bozza",
  chiudonoIl,
  nome,
  posti,
}: {
  stato?: StatoTappa;
  chiudonoIl: string | null;
  nome?: string;
  /** Maximum per board (BLVS-25 e2e fill a board). */
  posti?: number;
}): string {
  const id = `e2e-${crypto.randomUUID()}`;
  aggiungiDemoTappa(id, { stato, chiudonoIl, nome, posti });
  return id;
}

/** Adds a demo stage with a given id (e2e fixtures). */
export function aggiungiDemoTappa(
  id: string,
  {
    stato = "bozza",
    chiudonoIl,
    nome,
    confermate = { M: 4, F: 3 },
    posti,
  }: {
    stato?: StatoTappa;
    chiudonoIl: string | null;
    nome?: string;
    confermate?: { M: number; F: number };
    /** Maximum per board (BLVS-25 e2e fill a board). */
    posti?: number;
  },
): void {
  store().set(id, {
    row: {
      id,
      nome: nome ?? `Tappa di prova ${id.slice(4, 10)}`,
      luogo: "Spiaggia di prova",
      data_inizio: "2099-07-31",
      data_fine: "2099-08-01",
      stato,
      iscrizioni_aprono_il: null,
      iscrizioni_chiudono_il: chiudonoIl,
      iscrizioni_chiuse_il: null,
      chiusura_automatica: false,
    },
    tabelloni: [board("M", confermate.M, 1), board("F", confermate.F, 0)],
    posti,
  });
}
