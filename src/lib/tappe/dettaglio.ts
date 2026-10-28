import type {
  Categoria,
  FasePartita,
  StatoIscrizione,
  Tappa,
} from "@/lib/db/types";
import { scadenzaAnnullamento } from "@/lib/iscrizioni/annullamento/regola";
import {
  toAnnullamentoView,
  type AnnullamentoView,
} from "@/lib/iscrizioni/annullamento/view";
import {
  motivoBlocco,
  testoMotivo,
  type MotivoBlocco,
} from "@/lib/iscrizioni/motivo";
import {
  descriviPosti,
  formatPeriodoTappa,
  formatScadenza,
  type Posti,
} from "./format";

// ---------------------------------------------------------------------------
// w-tappa: the stage detail with its two boards
// ---------------------------------------------------------------------------

export const DETTAGLIO_TAPPA_COLUMNS =
  "id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_aprono_il, iscrizioni_chiudono_il, ritrovo, ritrovo_alle, programma, annullabile_fino_al";

/** A row of `public.tappe` as the detail reads it. */
export type DettaglioTappaRow = Pick<
  Tappa,
  | "id"
  | "nome"
  | "luogo"
  | "data_inizio"
  | "data_fine"
  | "stato"
  | "iscrizioni_aprono_il"
  | "iscrizioni_chiudono_il"
  | "ritrovo"
  | "ritrovo_alle"
  | "programma"
  | "annullabile_fino_al"
>;

/** A row of RPC `public.tabelloni_tappa(p_tappa)`. */
export type TabelloneTappaRow = {
  categoria: Categoria;
  posti: number;
  occupati: number;
  /** First free seat number; null when the board is full. */
  prossimo_posto: number | null;
  fase: FasePartita | null;
};

/** The player's own registration to the stage, if any. */
export type IscrizionePropria = {
  /** `iscrizioni.id`; in the demo, the stage id. */
  id: string;
  posto: number | null;
  stato: StatoIscrizione;
  categoria: Categoria;
  /** Already placed in a group: cancelling is refused (BLVS-51). */
  inGirone?: boolean;
};

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};

/** «nel maschile», «nel femminile». */
export function nelTabellone(categoria: Categoria): string {
  return `nel ${CATEGORIA_LABEL[categoria].toLowerCase()}`;
}

export type TabelloneDettaglio = {
  categoria: Categoria;
  label: string;
  posti: Posti;
  postiTesto: string;
  /** Board state in words: «Posti disponibili», «Completo», … */
  statoTesto: string;
  fase: FasePartita | null;
  /** The player's own category. */
  tuo: boolean;
};

export type TappaDettaglio = {
  id: string;
  nome: string;
  luogo: string;
  periodo: string;
  stato: Tappa["stato"];
  scadenza: string | null;
  scadenzaIso: string | null;
  ritrovo: string | null;
  ritrovoAlle: string | null;
  programma: string | null;
  fase: FasePartita | null;
  tabelloni: TabelloneDettaglio[];
  categoria: Categoria | null;
  iscrizione: IscrizionePropria | null;
  /** Label of the action button: «Prendi il posto 12 nel maschile». */
  azione: string;
  motivo: MotivoBlocco | null;
  motivoTesto: string | null;
  /** The player's active registration and whether it can be cancelled. */
  annullamento: AnnullamentoView | null;
};

const FASE_ORDINE: Record<FasePartita, number> = {
  gironi: 1,
  eliminazione: 2,
  finale: 3,
};

function statoTabellone(stato: Tappa["stato"], { liberi }: Posti): string {
  if (stato === "annullata") return "Annullato";
  if (stato === "in_corso") return "In gioco";
  if (stato === "conclusa") return "Concluso";
  if (liberi <= 0) return "Completo";
  if (stato === "iscrizioni_aperte") return "Posti disponibili";
  return "Iscrizioni chiuse";
}

const ISCRIZIONE_ATTIVA: readonly StatoIscrizione[] = [
  "in_attesa",
  "confermata",
];

/**
 * The detail view of a stage for the signed-in player. Pure: the reason
 * the button is disabled is computed with the server clock passed as `at`.
 */
export function toTappaDettaglio(
  row: DettaglioTappaRow,
  tabelloni: readonly TabelloneTappaRow[],
  {
    categoria,
    iscrizione,
    at,
  }: {
    categoria: Categoria | null;
    iscrizione: IscrizionePropria | null;
    at: Date;
  },
): TappaDettaglio {
  const boards = [...tabelloni].sort((a, b) =>
    a.categoria.localeCompare(b.categoria),
  );
  const own = categoria
    ? boards.find((b) => b.categoria === categoria)
    : undefined;
  const liberi = own ? Math.max(0, own.posti - own.occupati) : null;

  const motivo = motivoBlocco(
    {
      stato: row.stato,
      aprono: row.iscrizioni_aprono_il,
      chiudono: row.iscrizioni_chiudono_il,
      categoria,
      liberi,
      // A cancelled registration does not stop a new one (BLVS-51).
      iscritto: iscrizioneAttiva(iscrizione),
    },
    at,
  );
  const aperturaFutura =
    row.stato === "iscrizioni_aperte" &&
    row.iscrizioni_aprono_il &&
    new Date(row.iscrizioni_aprono_il) > at
      ? row.iscrizioni_aprono_il
      : null;

  let azione = "Prendi un posto";
  if (own && categoria) {
    const n = own.prossimo_posto;
    azione =
      n && (liberi ?? 0) > 0
        ? `Prendi il posto ${n} ${nelTabellone(categoria)}`
        : `Prendi un posto ${nelTabellone(categoria)}`;
  }

  const fase =
    row.stato === "in_corso"
      ? (own?.fase ??
        boards.reduce<FasePartita | null>(
          (best, b) =>
            b.fase && (!best || FASE_ORDINE[b.fase] > FASE_ORDINE[best])
              ? b.fase
              : best,
          null,
        ))
      : null;

  return {
    id: row.id,
    nome: row.nome,
    luogo: row.luogo,
    periodo: formatPeriodoTappa(row.data_inizio, row.data_fine),
    stato: row.stato,
    scadenza: row.iscrizioni_chiudono_il
      ? formatScadenza(row.iscrizioni_chiudono_il)
      : null,
    scadenzaIso: row.iscrizioni_chiudono_il,
    ritrovo: row.ritrovo,
    ritrovoAlle: row.ritrovo_alle ? formatScadenza(row.ritrovo_alle) : null,
    programma: row.programma?.trim() || null,
    fase,
    tabelloni: boards.map((b) => {
      const posti = {
        liberi: Math.max(0, b.posti - b.occupati),
        totali: b.posti,
      };
      return {
        categoria: b.categoria,
        label: CATEGORIA_LABEL[b.categoria],
        posti,
        postiTesto: descriviPosti(posti),
        statoTesto: statoTabellone(row.stato, posti),
        fase: row.stato === "in_corso" ? b.fase : null,
        tuo: b.categoria === categoria,
      };
    }),
    categoria,
    iscrizione,
    azione,
    motivo,
    motivoTesto: motivo
      ? testoMotivo(motivo, {
          chiudono: row.iscrizioni_chiudono_il,
          aprono: aperturaFutura,
        })
      : null,
    annullamento: annullamentoPerTappa(row, iscrizione, at),
  };
}

/** The cancel action of an active registration (BLVS-51); null without one. */
export function annullamentoPerTappa(
  row: DettaglioTappaRow,
  iscrizione: IscrizionePropria | null,
  at: Date,
): AnnullamentoView | null {
  if (!iscrizione || !iscrizioneAttiva(iscrizione)) return null;
  return toAnnullamentoView(
    {
      iscrizioneId: iscrizione.id,
      tappaId: row.id,
      nome: row.nome,
      posto: iscrizione.posto,
      categoria: iscrizione.categoria,
      stato: iscrizione.stato,
      inGirone: iscrizione.inGirone ?? false,
      tappa: row,
    },
    at,
  );
}

/** Only active registrations hold a seat. */
export function iscrizioneAttiva(
  iscrizione: IscrizionePropria | null,
): iscrizione is IscrizionePropria {
  return iscrizione !== null && ISCRIZIONE_ATTIVA.includes(iscrizione.stato);
}

// ---------------------------------------------------------------------------
// w-iscrizione-ok: the confirmation
// ---------------------------------------------------------------------------

export type IscrizioneConfermata = {
  tappaId: string;
  nome: string;
  posto: number | null;
  categoria: Categoria;
  periodo: string;
  luogo: string;
  ritrovo: string | null;
  ritrovoAlle: string | null;
  /** «21 giugno alle ore 23:59»: last moment to cancel (Europe/Rome). */
  annullaEntro: string | null;
  annullaEntroIso: string | null;
  /** «Annulla l'iscrizione» and its dialog (BLVS-51). */
  annullamento: AnnullamentoView | null;
};

export function toIscrizioneConfermata(
  row: DettaglioTappaRow,
  iscrizione: IscrizionePropria,
  at: Date,
): IscrizioneConfermata {
  const annulla = scadenzaAnnullamento(row);
  return {
    tappaId: row.id,
    nome: row.nome,
    posto: iscrizione.posto,
    categoria: iscrizione.categoria,
    periodo: formatPeriodoTappa(row.data_inizio, row.data_fine),
    luogo: row.luogo,
    ritrovo: row.ritrovo,
    ritrovoAlle: row.ritrovo_alle ? formatScadenza(row.ritrovo_alle) : null,
    annullaEntro: annulla ? formatScadenza(annulla) : null,
    annullaEntroIso: annulla,
    annullamento: annullamentoPerTappa(row, iscrizione, at),
  };
}
