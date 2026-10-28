import type { TipoEventoRegistro, ValoreRegistro } from "@/lib/audit";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import { romeToday } from "@/lib/time/rome-local";
import { formatServerTime } from "@/lib/time/server-time";
import type {
  PaginaRegistro,
  PartitaFiltro,
  PartitaFiltroDb,
  PartitaRegistroDb,
  TipoVoceView,
  VoceRegistroDb,
  VoceRegistroView,
} from "./types";

/**
 * Short labels of the log. Only the exceptions an arbiter must notice get
 * a filled badge (Correzione, Parità risolta); the rest is plain text.
 */
const TIPO_VOCE: Record<TipoEventoRegistro, { label: string; badge: boolean }> =
  {
    inserimento_punteggio: { label: "Inserimento", badge: false },
    correzione_punteggio: { label: "Correzione", badge: true },
    annullamento_punteggio: { label: "Annullamento", badge: false },
    ritiro: { label: "Ritiro", badge: false },
    assenza: { label: "Assenza", badge: false },
    parita_risolta: { label: "Parità risolta", badge: true },
    rigenerazione_gironi: { label: "Rigenerazione dei gironi", badge: false },
    cambio_categoria: { label: "Cambio di categoria", badge: false },
    chiusura_tabellone: { label: "Chiusura del tabellone", badge: false },
    punteggio_parziale: { label: "Parziale", badge: false },
    annullamento_iscrizione: { label: "Iscrizione annullata", badge: false },
  };

export function tipoVoce(tipo: TipoEventoRegistro): TipoVoceView {
  return { tipo, ...TIPO_VOCE[tipo] };
}

export const VUOTO = "—";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};

type Oggetto = { [key: string]: ValoreRegistro };

function oggetto(valore: ValoreRegistro | null | undefined): Oggetto | null {
  return valore && typeof valore === "object" && !Array.isArray(valore)
    ? valore
    : null;
}

function numero(valore: ValoreRegistro | undefined): number | null {
  return typeof valore === "number" && Number.isFinite(valore) ? valore : null;
}

/** The sets of a score: `{sets: [{a, b}]}` or the bare `[{a, b}]`. */
export function setsDi(
  valore: ValoreRegistro | null | undefined,
): { a: number; b: number }[] | null {
  const lista = Array.isArray(valore) ? valore : oggetto(valore)?.sets;
  if (!Array.isArray(lista)) return null;
  const sets = lista.flatMap((set) => {
    const s = oggetto(set);
    const a = numero(s?.a);
    const b = numero(s?.b);
    return a === null || b === null ? [] : [{ a, b }];
  });
  return sets.length === lista.length ? sets : null;
}

/** «21–18 · 15–21», «—» without sets. */
export function setsTesto(valore: ValoreRegistro | null | undefined): string {
  const sets = setsDi(valore);
  if (!sets || sets.length === 0) return VUOTO;
  return sets.map((s) => `${s.a}–${s.b}`).join(" · ");
}

function plurale(n: number, uno: string, molti: string) {
  return `${n} ${n === 1 ? uno : molti}`;
}

function contaGironi(valore: ValoreRegistro | undefined): number | null {
  if (Array.isArray(valore)) return valore.length;
  return numero(valore);
}

function testoLibero(valore: ValoreRegistro | null | undefined): string {
  if (valore === null || valore === undefined) return VUOTO;
  if (typeof valore === "string") return valore.trim() || VUOTO;
  if (typeof valore === "number" || typeof valore === "boolean") {
    return String(valore);
  }
  if (setsDi(valore)?.length) return setsTesto(valore);
  const o = oggetto(valore);
  for (const key of ["stato", "categoria", "valore"]) {
    const v = o?.[key];
    if (typeof v === "string" && v) return categoriaTesto(v);
  }
  return VUOTO;
}

function categoriaTesto(valore: ValoreRegistro | undefined): string {
  if (typeof valore !== "string") return VUOTO;
  return (CATEGORIE as readonly string[]).includes(valore)
    ? CATEGORIA_LABEL[valore as Categoria]
    : valore;
}

/** A partial (BLVS-37): `{parziale: {a, b}}` → «14-11», none → «—». */
function parzialeTesto(valore: ValoreRegistro | null | undefined): string {
  const parziale = oggetto(oggetto(valore)?.parziale);
  const a = numero(parziale?.a);
  const b = numero(parziale?.b);
  return a === null || b === null ? VUOTO : `${a}-${b}`;
}

/**
 * BLVS-42: `{giocatore, partite: [{girone, turno, sets, stato}]}` →
 * «Rossi Luca · Girone A t1 21–18, Girone A t2 da giocare» before and
 * «Girone A t1 annullata, …» after. Older shapes fall back to plain text.
 */
function ritiroTesto(
  tipo: "ritiro" | "assenza",
  prima: ValoreRegistro | null,
  dopo: ValoreRegistro | null,
): { prima: string; dopo: string } {
  const elenco = (valore: ValoreRegistro | null) => {
    const partite = oggetto(valore)?.partite;
    if (!Array.isArray(partite)) return null;
    return partite
      .map((voce) => {
        const p = oggetto(voce);
        const dove = [
          typeof p?.girone === "string" ? p.girone : null,
          numero(p?.turno) === null ? null : `t${numero(p?.turno)}`,
        ]
          .filter(Boolean)
          .join(" ");
        const esito =
          p?.stato === "annullata"
            ? "annullata"
            : setsDi(p)?.length
              ? setsTesto(p)
              : "da giocare";
        return [dove, esito].filter(Boolean).join(" ");
      })
      .join(", ");
  };
  const giocatore = oggetto(dopo)?.giocatore ?? oggetto(prima)?.giocatore;
  const primaTesto = elenco(prima);
  const dopoTesto = elenco(dopo);
  return {
    prima:
      primaTesto === null
        ? testoLibero(prima)
        : [typeof giocatore === "string" ? giocatore : null, primaTesto]
            .filter(Boolean)
            .join(" · ") || VUOTO,
    dopo:
      dopoTesto === null
        ? dopo === null
          ? tipo === "ritiro"
            ? "Ritirato"
            : "Assente"
          : testoLibero(dopo)
        : dopoTesto || VUOTO,
  };
}

function ordineTesto(valore: ValoreRegistro | null | undefined): string {
  const ordine = oggetto(valore)?.ordine;
  if (!Array.isArray(ordine) || ordine.length === 0) return VUOTO;
  return ordine
    .map((nome, i) => `${i + 1}. ${typeof nome === "string" ? nome : "?"}`)
    .join(", ");
}

/**
 * «Prima» and «dopo» of an entry as short text, per event type. Unknown
 * shapes fall back to the plain value, or «—».
 */
export function riepilogoValori(
  tipo: TipoEventoRegistro,
  prima: ValoreRegistro | null,
  dopo: ValoreRegistro | null,
): { prima: string; dopo: string } {
  switch (tipo) {
    case "inserimento_punteggio":
    case "correzione_punteggio":
      return {
        prima: setsTesto(prima),
        // BLVS-42: a withdrawal voids a match with a score.
        dopo:
          oggetto(dopo)?.stato === "annullata" && !setsDi(dopo)?.length
            ? "Partita annullata"
            : setsTesto(dopo),
      };
    case "annullamento_punteggio":
      return { prima: setsTesto(prima), dopo: "Annullato" };
    case "rigenerazione_gironi": {
      const p = oggetto(prima);
      const d = oggetto(dopo);
      const gironiPrima = contaGironi(p?.gironi);
      const gironiDopo = contaGironi(d?.gironi);
      const partite = numero(d?.partite);
      const persi = numero(d?.punteggi_persi ?? p?.punteggi_persi);
      return {
        prima:
          [
            gironiPrima === null
              ? null
              : plurale(gironiPrima, "girone", "gironi"),
            persi ? plurale(persi, "punteggio perso", "punteggi persi") : null,
          ]
            .filter(Boolean)
            .join(" · ") || VUOTO,
        dopo:
          [
            gironiDopo === null
              ? null
              : plurale(gironiDopo, "girone", "gironi"),
            partite === null ? null : plurale(partite, "partita", "partite"),
          ]
            .filter(Boolean)
            .join(" · ") || VUOTO,
      };
    }
    case "parita_risolta":
      return { prima: ordineTesto(prima), dopo: ordineTesto(dopo) };
    case "cambio_categoria": {
      // BLVS-54: {categoria, posto?, tappa_id?}; dopo also `oltre_massimo`.
      const testo = (valore: ValoreRegistro | null) => {
        const o = oggetto(valore);
        const posto = numero(o?.posto);
        return [
          categoriaTesto(o?.categoria ?? valore ?? undefined),
          posto === null ? null : `posto ${posto}`,
          o?.oltre_massimo === true ? "oltre il massimo" : null,
        ]
          .filter(Boolean)
          .join(" · ");
      };
      return { prima: testo(prima), dopo: testo(dopo) };
    }
    case "ritiro":
    case "assenza":
      return ritiroTesto(tipo, prima, dopo);
    case "punteggio_parziale":
      return { prima: parzialeTesto(prima), dopo: parzialeTesto(dopo) };
    case "annullamento_iscrizione": {
      // BLVS-51: prima/dopo = {stato, posto, categoria, tappa_id}.
      const p = oggetto(prima);
      const posto = numero(p?.posto);
      const categoria = p?.categoria;
      return {
        prima: [
          posto === null ? "Iscritto" : `Posto ${posto}`,
          categoria === "M" || categoria === "F"
            ? categoriaTesto(categoria)
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        dopo: "Annullata dal giocatore · posto libero",
      };
    }
    case "chiusura_tabellone": {
      // BLVS-43: dopo = {tappa_id, categoria, concluso_il, punti[]}.
      const d = oggetto(dopo);
      const categoria = d?.categoria;
      const punti = Array.isArray(d?.punti) ? d.punti.length : null;
      return {
        prima: "Aperto",
        dopo: [
          categoria === "M" || categoria === "F"
            ? `Concluso · ${categoriaTesto(categoria)}`
            : "Concluso",
          punti
            ? `punti definitivi per ${plurale(punti, "giocatore", "giocatori")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    default:
      return { prima: testoLibero(prima), dopo: testoLibero(dopo) };
  }
}

function squadra(nomi: readonly string[]): string {
  return nomi.length > 0 ? nomi.join(" e ") : "?";
}

/** «Girone A · Turno 2 · M — Anna Rossi e Luca Bianchi contro …». */
export function etichettaPartita(partita: PartitaRegistroDb): string {
  const dove =
    partita.girone ??
    (partita.fase === "finale" ? "Finale" : "Eliminazione diretta");
  return `${dove} · Turno ${partita.turno} · ${partita.categoria} — ${squadra(
    partita.squadra_a,
  )} contro ${squadra(partita.squadra_b)}`;
}

/** The match is gone (e.g. groups regenerated): the id is all that is left. */
export const PARTITA_RIMOSSA = "Partita non più presente";

export function toVoceView(row: VoceRegistroDb): VoceRegistroView {
  const data = new Date(row.created_at);
  const valori = riepilogoValori(row.tipo, row.valore_prima, row.valore_dopo);
  return {
    id: Number(row.id),
    tipo: tipoVoce(row.tipo),
    quando: data.toISOString(),
    giorno: romeToday(data),
    ora: formatServerTime(data, { hour: "2-digit", minute: "2-digit" }),
    dataOra: formatServerTime(data, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    autore: row.autore?.trim() || "Utente rimosso",
    partita: row.partita_id
      ? {
          id: row.partita_id,
          etichetta: row.partita
            ? etichettaPartita(row.partita)
            : PARTITA_RIMOSSA,
        }
      : null,
    prima: valori.prima,
    dopo: valori.dopo,
    nota: row.nota?.trim() || null,
  };
}

/** A page from the rows of `registro_tappa()`. */
export function toPagina(rows: readonly VoceRegistroDb[]): PaginaRegistro {
  return {
    voci: rows.map(toVoceView),
    restanti:
      rows.length > 0 ? Math.max(0, Number(rows[0].totale) - rows.length) : 0,
  };
}

export function toPartiteFiltro(
  rows: readonly PartitaFiltroDb[],
): PartitaFiltro[] {
  return rows
    .map((r) => ({
      id: r.partita_id,
      etichetta: r.partita ? etichettaPartita(r.partita) : PARTITA_RIMOSSA,
    }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, "it"));
}
