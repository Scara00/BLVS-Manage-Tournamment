/**
 * w-mie-iscrizioni (BLVS-51): the player's registrations, split into
 * upcoming and past stages, with the result of each played stage and the
 * season summary taken from the overall standing (BLVS-44). Pure: the
 * server clock is passed as `at`.
 */
import type { RigaGenerale } from "@/lib/classifica-generale/types";
import type { Categoria, StatoIscrizione, StatoTappa } from "@/lib/db/types";
import {
  toAnnullamentoView,
  type AnnullamentoView,
} from "@/lib/iscrizioni/annullamento/view";
import { formatPeriodoTappa, STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import { romeToday } from "@/lib/time/rome-local";

/** One registration as the read returns it. */
export type IscrizioneMiaRow = {
  /** `iscrizioni.id`; in the demo, the stage id. */
  id: string;
  stato: StatoIscrizione;
  posto: number | null;
  categoria: Categoria;
  inGirone: boolean;
  tappa: {
    id: string;
    nome: string;
    luogo: string;
    data_inizio: string;
    data_fine: string;
    stato: StatoTappa;
    stagione: number;
    iscrizioni_chiudono_il: string | null;
    annullabile_fino_al: string | null;
  };
  /** False for stages the player pages cannot open (demo-only rows). */
  apribile?: boolean;
};

/** The player's result in one stage (BLVS-40 points, from BLVS-44). */
export type RisultatoMio = {
  /** Place in the stage standing; null when out before the finals. */
  posizione: number | null;
  punti: number;
  provvisori: boolean;
};

/** The registration state in words: never by colour alone. */
export const STATO_ISCRIZIONE_LABEL: Record<StatoIscrizione, string> = {
  in_attesa: "Iscritto",
  confermata: "Iscrizione confermata",
  ritirata: "Iscrizione annullata",
  rifiutata: "Iscrizione rifiutata",
};

export type TonoStato = "attiva" | "annullata" | "neutro";

export type IscrizioneMia = {
  id: string;
  tappaId: string;
  nome: string;
  luogo: string;
  periodo: string;
  /** `YYYY-MM-DD`, for `<time>`. */
  dataInizio: string;
  statoTappa: StatoTappa;
  statoTappaTesto: string;
  stato: StatoIscrizione;
  statoTesto: string;
  tono: TonoStato;
  posto: number | null;
  categoria: Categoria;
  quando: "prossima" | "passata";
  /** Link to w-tappa; false for demo-only rows that have no page. */
  apribile: boolean;
  /** Only for active registrations. */
  annullamento: AnnullamentoView | null;
  risultato: RisultatoMio | null;
  /** «2° posto · 8 punti (provvisori)», «Fuori prima delle finali · 0 punti». */
  risultatoTesto: string | null;
};

export type RiepilogoStagione = {
  stagione: number;
  categoria: Categoria;
  punti: number;
  tappeGiocate: number;
  /** Place in the overall standing; null when not in it yet. */
  posizione: number | null;
  pariMerito: boolean;
  provvisori: boolean;
  /** Players in the overall standing of the category. */
  giocatori: number;
};

export type MieIscrizioniView = {
  prossime: IscrizioneMia[];
  passate: IscrizioneMia[];
  stagione: RiepilogoStagione | null;
};

const STATI_PASSATI: readonly StatoTappa[] = ["conclusa", "archiviata"];

/**
 * Past = the stage is over (concluded or archived) or its last day is
 * behind today in Rome. In progress stays among the upcoming ones.
 */
export function quandoTappa(
  tappa: Pick<IscrizioneMiaRow["tappa"], "stato" | "data_fine">,
  at: Date,
): IscrizioneMia["quando"] {
  if (STATI_PASSATI.includes(tappa.stato)) return "passata";
  return tappa.data_fine < romeToday(at) ? "passata" : "prossima";
}

function statoTesto(row: IscrizioneMiaRow): { testo: string; tono: TonoStato } {
  if (row.stato === "ritirata")
    return { testo: STATO_ISCRIZIONE_LABEL.ritirata, tono: "annullata" };
  if (row.stato === "rifiutata")
    return { testo: STATO_ISCRIZIONE_LABEL.rifiutata, tono: "neutro" };
  if (row.tappa.stato === "annullata")
    return { testo: "Tappa annullata", tono: "neutro" };
  return { testo: STATO_ISCRIZIONE_LABEL[row.stato], tono: "attiva" };
}

/** «2° posto», «1° posto a pari merito». */
export function posizioneTesto(posizione: number, pariMerito = false) {
  return `${posizione}° posto${pariMerito ? " a pari merito" : ""}`;
}

export function puntiTesto(punti: number) {
  return punti === 1 ? "1 punto" : `${punti} punti`;
}

export function risultatoTesto(risultato: RisultatoMio): string {
  const dove =
    risultato.posizione === null
      ? "Fuori prima delle finali"
      : posizioneTesto(risultato.posizione);
  return `${dove} · ${puntiTesto(risultato.punti)}${
    risultato.provvisori ? " (provvisori)" : ""
  }`;
}

/** Stages whose standing exists: started or over (BLVS-44 `tappa_in_classifica`). */
const STATI_CON_RISULTATO: readonly StatoTappa[] = [
  "in_corso",
  "conclusa",
  "archiviata",
];

export function toIscrizioneMia(
  row: IscrizioneMiaRow,
  risultato: RisultatoMio | null,
  at: Date,
): IscrizioneMia {
  const { testo, tono } = statoTesto(row);
  const attiva = row.stato === "in_attesa" || row.stato === "confermata";
  const conRisultato =
    attiva && STATI_CON_RISULTATO.includes(row.tappa.stato) ? risultato : null;
  return {
    id: row.id,
    tappaId: row.tappa.id,
    nome: row.tappa.nome,
    luogo: row.tappa.luogo,
    periodo: formatPeriodoTappa(row.tappa.data_inizio, row.tappa.data_fine),
    dataInizio: row.tappa.data_inizio,
    statoTappa: row.tappa.stato,
    statoTappaTesto: STATO_TAPPA_LABEL[row.tappa.stato],
    stato: row.stato,
    statoTesto: testo,
    tono,
    posto: row.posto,
    categoria: row.categoria,
    quando: quandoTappa(row.tappa, at),
    apribile: row.apribile ?? true,
    annullamento: attiva
      ? toAnnullamentoView(
          {
            iscrizioneId: row.id,
            tappaId: row.tappa.id,
            nome: row.tappa.nome,
            posto: row.posto,
            categoria: row.categoria,
            stato: row.stato,
            inGirone: row.inGirone,
            tappa: row.tappa,
          },
          at,
        )
      : null,
    risultato: conRisultato,
    risultatoTesto: conRisultato ? risultatoTesto(conRisultato) : null,
  };
}

/** The player's row of the overall standing as the season summary. */
export function riepilogoStagione(
  {
    stagione,
    categoria,
    righe,
  }: { stagione: number; categoria: Categoria; righe: readonly RigaGenerale[] },
  utenteId: string,
): RiepilogoStagione {
  const riga = righe.find((r) => r.utenteId === utenteId);
  return {
    stagione,
    categoria,
    punti: riga?.punti ?? 0,
    tappeGiocate: riga?.tappeGiocate ?? 0,
    posizione: riga?.posizione ?? null,
    pariMerito: riga?.pariMerito ?? false,
    provvisori: riga?.puntiProvvisori ?? false,
    giocatori: righe.length,
  };
}

/** The player's result in `tappaId`, from their row of the standing. */
export function risultatoDaClassifica(
  righe: readonly RigaGenerale[],
  utenteId: string,
  tappaId: string,
): RisultatoMio | null {
  const tappa = righe
    .find((r) => r.utenteId === utenteId)
    ?.tappe.find((t) => t.tappaId === tappaId);
  return tappa
    ? {
        posizione: tappa.posizione,
        punti: tappa.punti,
        provvisori: tappa.provvisori,
      }
    : null;
}

/**
 * Upcoming stages soonest first, past ones most recent first. Within a
 * day, active registrations come before cancelled ones.
 */
export function dividiIscrizioni(
  iscrizioni: readonly IscrizioneMia[],
): Pick<MieIscrizioniView, "prossime" | "passate"> {
  const prossime = iscrizioni
    .filter((i) => i.quando === "prossima")
    .sort(
      (a, b) =>
        a.dataInizio.localeCompare(b.dataInizio) ||
        a.nome.localeCompare(b.nome),
    );
  const passate = iscrizioni
    .filter((i) => i.quando === "passata")
    .sort(
      (a, b) =>
        b.dataInizio.localeCompare(a.dataInizio) ||
        a.nome.localeCompare(b.nome),
    );
  return { prossime, passate };
}
