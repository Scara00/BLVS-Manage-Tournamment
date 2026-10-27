import type { DemoAdminStage } from "@/lib/demo/tournament";
import {
  CATEGORIE,
  STATI_TAPPA,
  type Categoria,
  type FaseTabellone,
  type StatoTappa,
} from "@/lib/db/types";
import { formatPeriodoTappa } from "@/lib/tappe/format";

/** One category (board) of a stage, as the admin table shows it. */
export type AdminCategoria = {
  categoria: Categoria;
  /** Registrations still counting for a seat: pending or confirmed. */
  iscritti: number;
  posti: number;
  fase: FaseTabellone | null;
  /** Results closed for good (BLVS-43 `tabelloni.concluso_il`). */
  concluso: boolean;
};

/** A stage row of the admin dashboard table (drafts included). */
export type AdminTappa = {
  id: string;
  nome: string;
  periodo: string;
  stato: StatoTappa;
  /** Why it was cancelled; null unless cancelled (or archived after it). */
  motivoAnnullamento: string | null;
  /** M first, then F. */
  categorie: AdminCategoria[];
  /** Matches being played, or past their time with no score yet. */
  partiteDaInserire: number;
  /** Today falls inside the stage dates and the stage is running. */
  giornoDiGara: boolean;
};

/** A row of `public.admin_riepilogo_tappe()`. */
export type AdminTappaRpcRow = {
  id: string;
  nome: string;
  data_inizio: string;
  data_fine: string;
  stato: StatoTappa;
  motivo_annullamento: string | null;
  categorie: {
    categoria: Categoria;
    posti: number;
    fase: FaseTabellone | null;
    concluso?: boolean;
    iscritti: number;
  }[];
  partite_da_inserire: number;
};

export type FiltroStato = StatoTappa | "tutte";

/** Query parameter of the status filter: `/admin?stato=bozza`. */
export const FILTRO_STATO_PARAM = "stato";

export const FILTRI_STATO: readonly FiltroStato[] = ["tutte", ...STATI_TAPPA];

/** Reads `?stato=`; anything unknown (or repeated) means every stage. */
export function parseFiltroStato(
  raw: string | string[] | null | undefined,
): FiltroStato {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (STATI_TAPPA as readonly string[]).includes(value ?? "")
    ? (value as StatoTappa)
    : "tutte";
}

export function filtraPerStato<T extends { stato: StatoTappa }>(
  tappe: readonly T[],
  filtro: FiltroStato,
): T[] {
  return filtro === "tutte"
    ? [...tappe]
    : tappe.filter((tappa) => tappa.stato === filtro);
}

/** How many stages each filter would show, for the filter labels. */
export function contaPerStato(
  tappe: readonly { stato: StatoTappa }[],
): Record<FiltroStato, number> {
  const counts = Object.fromEntries(
    FILTRI_STATO.map((filtro) => [filtro, 0]),
  ) as Record<FiltroStato, number>;
  for (const tappa of tappe) counts[tappa.stato] += 1;
  counts.tutte = tappe.length;
  return counts;
}

export type Posti = {
  iscritti: number;
  posti: number;
  liberi: number;
  /** Registrations beyond the seats (waiting list). */
  inEccesso: number;
  completo: boolean;
};

/** Seat count of one board. Negative inputs count as zero. */
export function contaPosti({
  iscritti,
  posti,
}: Pick<AdminCategoria, "iscritti" | "posti">): Posti {
  const taken = Math.max(0, iscritti);
  const seats = Math.max(0, posti);
  return {
    iscritti: taken,
    posti: seats,
    liberi: Math.max(0, seats - taken),
    inEccesso: Math.max(0, taken - seats),
    completo: taken >= seats,
  };
}

/** «4 posti liberi», «1 posto libero», «Completo», «Completo · 2 in attesa». */
export function descriviPosti(posti: Posti): string {
  if (!posti.completo) {
    return posti.liberi === 1
      ? "1 posto libero"
      : `${posti.liberi} posti liberi`;
  }
  return posti.inEccesso > 0
    ? `Completo · ${posti.inEccesso} in eccesso`
    : "Completo";
}

/** «1 partita da inserire», «3 partite da inserire». */
export function partiteDaInserireLabel(count: number): string {
  return count === 1 ? "1 partita da inserire" : `${count} partite da inserire`;
}

/** Whether `oggi` (YYYY-MM-DD, Europe/Rome) is a race day of the stage. */
export function isGiornoDiGara(
  tappa: { stato: StatoTappa; data_inizio: string; data_fine: string },
  oggi: string,
): boolean {
  return (
    tappa.stato === "in_corso" &&
    tappa.data_inizio <= oggi &&
    oggi <= tappa.data_fine
  );
}

function categorie(row: AdminTappaRpcRow): AdminCategoria[] {
  return CATEGORIE.map((categoria) => {
    const found = row.categorie.find((c) => c.categoria === categoria);
    return {
      categoria,
      iscritti: Number(found?.iscritti ?? 0),
      posti: Number(found?.posti ?? 0),
      fase: found?.fase ?? null,
      concluso: found?.concluso === true,
    };
  });
}

export function toAdminTappa(row: AdminTappaRpcRow, oggi: string): AdminTappa {
  return {
    id: row.id,
    nome: row.nome,
    periodo: formatPeriodoTappa(row.data_inizio, row.data_fine),
    stato: row.stato,
    motivoAnnullamento: row.motivo_annullamento ?? null,
    categorie: categorie(row),
    partiteDaInserire: Number(row.partite_da_inserire),
    giornoDiGara: isGiornoDiGara(row, oggi),
  };
}

/** Pending results of the stages raced today: what the banner counts. */
export function partiteDaInserireOggi(tappe: readonly AdminTappa[]) {
  return tappe
    .filter((tappa) => tappa.giornoDiGara)
    .map((tappa) => ({
      id: tappa.id,
      label: tappa.nome,
      count: tappa.partiteDaInserire,
    }));
}

export function demoAdminTappa(stage: DemoAdminStage): AdminTappa {
  const [m, f] = stage.boards;
  return {
    id: stage.id,
    nome: stage.name,
    periodo: stage.date,
    stato: stage.status,
    motivoAnnullamento: stage.reason ?? null,
    categorie: [
      {
        categoria: "M",
        iscritti: m.registered,
        posti: m.seats,
        fase: m.phase,
        concluso: m.concluded === true,
      },
      {
        categoria: "F",
        iscritti: f.registered,
        posti: f.seats,
        fase: f.phase,
        concluso: f.concluded === true,
      },
    ],
    partiteDaInserire: stage.pendingScores,
    // Demo dates are labels: the stage in progress is racing «today».
    giornoDiGara: stage.status === "in_corso",
  };
}

// ---------------------------------------------------------------------------
// BLVS-22 · Annullamento e archiviazione
// ---------------------------------------------------------------------------

/** States a stage can be cancelled from (trigger `tappe_annulla_archivia`). */
export const STATI_ANNULLABILI: readonly StatoTappa[] = [
  "bozza",
  "iscrizioni_aperte",
  "iscrizioni_chiuse",
  "in_corso",
];

export function isAnnullabile(tappa: Pick<AdminTappa, "stato">): boolean {
  return STATI_ANNULLABILI.includes(tappa.stato);
}

/** Both boards concluded: the results are final. */
export function tabelloniConclusi(tappa: Pick<AdminTappa, "categorie">) {
  return tappa.categorie.length > 0 && tappa.categorie.every((c) => c.concluso);
}

/**
 * Whether «Archivia» is enabled. Mirrors the trigger, which is the real
 * guard: a cancelled stage, or one whose two boards are both concluded.
 */
export function isArchiviabile(
  tappa: Pick<AdminTappa, "stato" | "categorie">,
): boolean {
  if (tappa.stato === "archiviata") return false;
  return tappa.stato === "annullata" || tabelloniConclusi(tappa);
}

/** Players the cancellation notice goes to: pending or confirmed, M + F. */
export function iscrittiDaAvvisare(tappa: Pick<AdminTappa, "categorie">) {
  return tappa.categorie.reduce((sum, c) => sum + Math.max(0, c.iscritti), 0);
}
