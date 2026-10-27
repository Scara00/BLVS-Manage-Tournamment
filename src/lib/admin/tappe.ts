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
};

/** A stage row of the admin dashboard table (drafts included). */
export type AdminTappa = {
  id: string;
  nome: string;
  periodo: string;
  stato: StatoTappa;
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
  categorie: {
    categoria: Categoria;
    posti: number;
    fase: FaseTabellone | null;
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
    };
  });
}

export function toAdminTappa(row: AdminTappaRpcRow, oggi: string): AdminTappa {
  return {
    id: row.id,
    nome: row.nome,
    periodo: formatPeriodoTappa(row.data_inizio, row.data_fine),
    stato: row.stato,
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
    categorie: [
      { categoria: "M", iscritti: m.registered, posti: m.seats, fase: m.phase },
      { categoria: "F", iscritti: f.registered, posti: f.seats, fase: f.phase },
    ],
    partiteDaInserire: stage.pendingScores,
    // Demo dates are labels: the stage in progress is racing «today».
    giornoDiGara: stage.status === "in_corso",
  };
}
