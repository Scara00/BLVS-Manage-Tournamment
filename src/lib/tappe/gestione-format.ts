import type { Categoria, StatoTappa, Tappa } from "@/lib/db/types";
import { formatPeriodoTappa, STATO_TAPPA_LABEL } from "./format";
import {
  confrontoOraDopo,
  COPY_TRANSIZIONE,
  FLUSSO_ISCRIZIONI,
  formatIstante,
  formatOra,
  giorniAllaChiusura,
  isStatoFlusso,
  prossimoStato,
  requisitoApertura,
  tipoTransizione,
  toRomeLocalInput,
  type CopyTransizione,
  type RigaConfronto,
  type StatoFlusso,
  type TipoTransizione,
} from "./stato";

export type TappaGestioneRow = Pick<
  Tappa,
  | "id"
  | "nome"
  | "luogo"
  | "data_inizio"
  | "data_fine"
  | "stato"
  | "iscrizioni_aprono_il"
  | "iscrizioni_chiudono_il"
  | "iscrizioni_chiuse_il"
  | "chiusura_automatica"
>;

export const TAPPA_GESTIONE_COLUMNS =
  "id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_aprono_il, iscrizioni_chiudono_il, iscrizioni_chiuse_il, chiusura_automatica";

/** Per board: registrations by state and the phases of its matches. */
export type TabelloneRow = {
  categoria: Categoria;
  confermate: number;
  inAttesa: number;
  /** `partite.fase` of every match of the board. */
  fasiPartite: readonly string[];
};

export type PassoFlusso = {
  stato: StatoFlusso;
  /** 1-based position, shown as «1», «2», «3». */
  indice: number;
  label: string;
  posizione: "fatto" | "attuale" | "futuro";
};

export type ScadenzaView = {
  /** Main line, e.g. «Chiusura tra 3 giorni». */
  titolo: string;
  /** Second line with the exact date and what happens then. */
  dettaglio: string;
  /** Calendar days to the deadline, when it is still ahead. */
  giorni: number | null;
  automatica: boolean;
};

export type TransizioneView = CopyTransizione & {
  da: StatoTappa;
  a: StatoTappa;
  tipo: TipoTransizione;
  confronto: RigaConfronto[];
  /** Why the change cannot be made now (shown next to the button). */
  bloccata: string | null;
};

export type TabelloneView = {
  categoria: Categoria;
  categoriaLabel: string;
  iscritti: number;
  inAttesa: number;
  fase: string;
};

export type GestioneTappaView = {
  id: string;
  nome: string;
  luogo: string;
  periodo: string;
  stato: StatoTappa;
  statoLabel: string;
  flusso: PassoFlusso[];
  /** For states after the flow (in corso, conclusa, annullata). */
  notaStato: string | null;
  scadenza: ScadenzaView;
  /** The deadline can change only before registrations close. */
  scadenzaModificabile: boolean;
  /** Current deadline as `datetime-local` value (Rome), or "". */
  scadenzaInput: string;
  transizione: TransizioneView | null;
  tabelloni: TabelloneView[];
};

export const CATEGORIA_TABELLONE: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};

const FASE_PARTITA: Record<string, string> = {
  gironi: "Gironi",
  eliminazione: "Eliminazione diretta",
  finale: "Finale",
};
const ORDINE_FASI = ["gironi", "eliminazione", "finale"];

const FASE_DA_STATO: Record<StatoTappa, string> = {
  bozza: "In preparazione",
  iscrizioni_aperte: "Raccolta iscrizioni",
  iscrizioni_chiuse: "Iscrizioni chiuse, gironi da comporre",
  in_corso: "In attesa delle partite",
  conclusa: "Concluso",
  annullata: "Annullato",
};

/** Phase of a board: its most advanced match phase, else from the stage. */
export function faseTabellone(
  stato: StatoTappa,
  fasiPartite: readonly string[],
): string {
  if (stato === "conclusa" || stato === "annullata")
    return FASE_DA_STATO[stato];
  const piuAvanti = fasiPartite
    .filter((f) => ORDINE_FASI.includes(f))
    .sort((a, b) => ORDINE_FASI.indexOf(b) - ORDINE_FASI.indexOf(a))[0];
  return piuAvanti ? FASE_PARTITA[piuAvanti] : FASE_DA_STATO[stato];
}

function flussoDi(stato: StatoTappa): PassoFlusso[] {
  // After the flow (in corso, conclusa…) every step is done; cancelled
  // stages show no current step.
  const corrente = isStatoFlusso(stato)
    ? FLUSSO_ISCRIZIONI.indexOf(stato)
    : stato === "annullata"
      ? -1
      : FLUSSO_ISCRIZIONI.length;
  return FLUSSO_ISCRIZIONI.map((passo, i) => ({
    stato: passo,
    indice: i + 1,
    label: STATO_TAPPA_LABEL[passo],
    posizione:
      corrente === -1 || i > corrente
        ? "futuro"
        : i === corrente
          ? "attuale"
          : "fatto",
  }));
}

const NOTA_STATO: Partial<Record<StatoTappa, string>> = {
  in_corso: "La tappa è in corso: le iscrizioni sono chiuse.",
  conclusa: "La tappa è conclusa.",
  annullata: "La tappa è stata annullata: le iscrizioni non sono più attive.",
};

function quando(giorni: number, chiudonoIl: Date): string {
  if (giorni === 0) return `Chiusura oggi alle ${formatOra(chiudonoIl)}`;
  if (giorni === 1) return `Chiusura domani alle ${formatOra(chiudonoIl)}`;
  return `Chiusura tra ${giorni} giorni`;
}

export function scadenzaDi(row: TappaGestioneRow, at: Date): ScadenzaView {
  const chiudonoIl = row.iscrizioni_chiudono_il
    ? new Date(row.iscrizioni_chiudono_il)
    : null;
  const chiuseIl = row.iscrizioni_chiuse_il
    ? new Date(row.iscrizioni_chiuse_il)
    : null;

  if (row.stato === "iscrizioni_chiuse") {
    if (row.chiusura_automatica) {
      return {
        titolo: "Iscrizioni chiuse automaticamente alla scadenza",
        dettaglio: `Il sistema le ha chiuse il ${formatIstante(chiuseIl ?? chiudonoIl ?? at)}.`,
        giorni: null,
        automatica: true,
      };
    }
    return {
      titolo: "Iscrizioni chiuse a mano",
      dettaglio: chiuseIl
        ? `Chiuse dall'amministrazione il ${formatIstante(chiuseIl)}.`
        : "Chiuse dall'amministrazione.",
      giorni: null,
      automatica: false,
    };
  }

  if (!isStatoFlusso(row.stato)) {
    return {
      titolo: "Iscrizioni chiuse",
      dettaglio: chiudonoIl
        ? `La scadenza era il ${formatIstante(chiudonoIl)}.`
        : "Nessuna scadenza registrata.",
      giorni: null,
      automatica: false,
    };
  }

  if (!chiudonoIl) {
    return {
      titolo: "Scadenza non impostata",
      dettaglio:
        "Imposta la scadenza: serve per aprire le iscrizioni, che alla scadenza si chiudono da sole.",
      giorni: null,
      automatica: false,
    };
  }

  if (chiudonoIl.getTime() <= at.getTime()) {
    return {
      titolo: "Scadenza passata",
      dettaglio:
        row.stato === "bozza"
          ? `La scadenza era il ${formatIstante(chiudonoIl)}: impostane una futura per aprire le iscrizioni.`
          : `Scaduta il ${formatIstante(chiudonoIl)}: le iscrizioni si stanno chiudendo automaticamente.`,
      giorni: null,
      automatica: true,
    };
  }

  const giorni = giorniAllaChiusura(chiudonoIl, at);
  return {
    titolo: quando(giorni, chiudonoIl),
    dettaglio:
      row.stato === "bozza"
        ? `Una volta aperte, le iscrizioni si chiuderanno automaticamente il ${formatIstante(chiudonoIl)}.`
        : `Il ${formatIstante(chiudonoIl)} le iscrizioni si chiudono automaticamente.`,
    giorni,
    automatica: true,
  };
}

function transizioneDi(
  row: TappaGestioneRow,
  at: Date,
): TransizioneView | null {
  const a = prossimoStato(row.stato);
  const tipo = a ? tipoTransizione(row.stato, a) : null;
  if (!a || !tipo) return null;
  const chiudonoIl = row.iscrizioni_chiudono_il
    ? new Date(row.iscrizioni_chiudono_il)
    : null;
  return {
    ...COPY_TRANSIZIONE[tipo],
    da: row.stato,
    a,
    tipo,
    confronto: confrontoOraDopo(row.stato, a, chiudonoIl),
    bloccata: tipo === "apertura" ? requisitoApertura(chiudonoIl, at) : null,
  };
}

/** Everything the management page shows, computed at `at`. */
export function toGestioneTappaView(
  row: TappaGestioneRow,
  tabelloni: readonly TabelloneRow[],
  at: Date,
): GestioneTappaView {
  return {
    id: row.id,
    nome: row.nome,
    luogo: row.luogo,
    periodo: formatPeriodoTappa(row.data_inizio, row.data_fine),
    stato: row.stato,
    statoLabel: STATO_TAPPA_LABEL[row.stato],
    flusso: flussoDi(row.stato),
    notaStato: NOTA_STATO[row.stato] ?? null,
    scadenza: scadenzaDi(row, at),
    scadenzaModificabile:
      row.stato === "bozza" || row.stato === "iscrizioni_aperte",
    scadenzaInput: row.iscrizioni_chiudono_il
      ? toRomeLocalInput(new Date(row.iscrizioni_chiudono_il))
      : "",
    transizione: transizioneDi(row, at),
    tabelloni: [...tabelloni]
      .sort((x, y) =>
        x.categoria === y.categoria ? 0 : x.categoria === "M" ? -1 : 1,
      )
      .map((t) => ({
        categoria: t.categoria,
        categoriaLabel: CATEGORIA_TABELLONE[t.categoria],
        iscritti: t.confermate,
        inAttesa: t.inAttesa,
        fase: faseTabellone(row.stato, t.fasiPartite),
      })),
  };
}

/** A row of the admin stage list. */
export type TappaAdminItem = {
  id: string;
  nome: string;
  luogo: string;
  periodo: string;
  stato: StatoTappa;
  statoLabel: string;
  scadenza: string;
};

export function toTappaAdminItem(
  row: TappaGestioneRow,
  at: Date,
): TappaAdminItem {
  return {
    id: row.id,
    nome: row.nome,
    luogo: row.luogo,
    periodo: formatPeriodoTappa(row.data_inizio, row.data_fine),
    stato: row.stato,
    statoLabel: STATO_TAPPA_LABEL[row.stato],
    scadenza: scadenzaDi(row, at).titolo,
  };
}
