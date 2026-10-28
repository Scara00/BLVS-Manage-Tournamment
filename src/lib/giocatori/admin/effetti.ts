/**
 * w-admin-categoria-conferma: what a category change does, from the RPC
 * `effetti_cambio_categoria` plus the points moved (`spostamentoPunti`),
 * written as sentences. Pure.
 */
import { dataTappaLabel } from "@/lib/classifica-generale/giocatore";
import type { Categoria, StatoTappa } from "@/lib/db/types";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";
import type {
  EffettiCambio,
  EffettoAtteso,
  IscrizioneSpostata,
  SpostamentoStagione,
  TappaBloccante,
} from "./types";

/** The jsonb of `effetti_cambio_categoria(utente, categoria)`. */
export type EffettiRpc = {
  da: Categoria | null;
  a: Categoria;
  iscrizioni: {
    iscrizione_id: string;
    tappa_id: string;
    tappa: string;
    data_inizio: string;
    stato_tappa: StatoTappa;
    posto_prima: number | null;
    posto_dopo: number;
    posti: number;
    occupati: number;
    oltre_massimo: boolean;
    in_girone: boolean;
  }[];
  bloccanti: { tappa_id: string; tappa: string; data_inizio: string }[];
};

export function effettiDaRpc(
  rpc: EffettiRpc,
  punti: SpostamentoStagione[],
): EffettiCambio {
  return {
    da: rpc.da,
    a: rpc.a,
    iscrizioni: rpc.iscrizioni.map((i): IscrizioneSpostata => ({
      iscrizioneId: i.iscrizione_id,
      tappaId: i.tappa_id,
      tappa: i.tappa,
      data: i.data_inizio,
      statoTappa: i.stato_tappa,
      postoPrima: i.posto_prima,
      postoDopo: i.posto_dopo,
      posti: i.posti,
      occupati: Number(i.occupati),
      oltreMassimo: i.oltre_massimo,
      inGirone: i.in_girone,
    })),
    bloccanti: rpc.bloccanti.map((b): TappaBloccante => ({
      tappaId: b.tappa_id,
      tappa: b.tappa,
      data: b.data_inizio,
    })),
    punti,
  };
}

/** What the dialog confirmed: checked again by the RPC. */
export function effettiAttesi(effetti: EffettiCambio): EffettoAtteso[] {
  return effetti.iscrizioni.map((i) => ({
    iscrizione_id: i.iscrizioneId,
    posto_dopo: i.postoDopo,
  }));
}

/** Parses the `attesi` field of the form; null when malformed. */
export function leggiAttesi(valore: string): EffettoAtteso[] | null {
  try {
    const dati: unknown = JSON.parse(valore);
    if (!Array.isArray(dati)) return null;
    const attesi: EffettoAtteso[] = [];
    for (const x of dati) {
      if (
        typeof x !== "object" ||
        x === null ||
        typeof (x as EffettoAtteso).iscrizione_id !== "string" ||
        !Number.isInteger((x as EffettoAtteso).posto_dopo)
      ) {
        return null;
      }
      const { iscrizione_id, posto_dopo } = x as EffettoAtteso;
      attesi.push({ iscrizione_id, posto_dopo });
    }
    return attesi;
  } catch {
    return null;
  }
}

/** «maschile», «femminile». */
export function categoriaMinuscola(categoria: Categoria): string {
  return CATEGORIA_LABEL[categoria].toLowerCase();
}

const plurale = (n: number, uno: string, molti: string) =>
  `${n} ${n === 1 ? uno : molti}`;

/** «Tappa 4 · Lignano (4 luglio 2027): dal posto 7 del tabellone maschile al posto 3 di 16 del femminile.» */
export function testoIscrizione(
  i: IscrizioneSpostata,
  da: Categoria | null,
  a: Categoria,
): string {
  const prima =
    i.postoPrima !== null && da
      ? `dal posto ${i.postoPrima} del tabellone ${categoriaMinuscola(da)}`
      : "dal tabellone attuale";
  const dopo = i.oltreMassimo
    ? `al posto ${i.postoDopo} del ${categoriaMinuscola(a)}, oltre il massimo di ${i.posti} posti (tabellone pieno)`
    : `al posto ${i.postoDopo} di ${i.posti} del ${categoriaMinuscola(a)}`;
  const girone = i.inGirone
    ? " Esce dai gironi già proposti: vanno rivisti."
    : "";
  return `${i.tappa} (${dataTappaLabel(i.data)}): ${prima} ${dopo}.${girone}`;
}

const ordinale = (n: number | null) => (n === null ? "–" : `${n}º`);

/** «Stagione 2026: 20 punti (2 tappe) passano dalla classifica maschile (ora 3º) a quella femminile (sarà 5º).» */
export function testoPunti(
  s: SpostamentoStagione,
  da: Categoria,
  a: Categoria,
): string {
  const provvisori = s.provvisori ? ", in parte provvisori," : "";
  return (
    `Stagione ${s.stagione}: ${plurale(s.punti, "punto", "punti")} ` +
    `(${plurale(s.tappe, "tappa", "tappe")})${provvisori} passano dalla ` +
    `classifica ${categoriaMinuscola(da)} (ora ${ordinale(s.posizionePrima)}) ` +
    `a quella ${categoriaMinuscola(a)} (sarà ${ordinale(s.posizioneDopo)}).`
  );
}

/** «Iscritto a Tappa 2 · Rimini, in corso: …» */
export function testoBloccante(b: TappaBloccante): string {
  return `È iscritto a ${b.tappa}, in corso: la categoria si potrà cambiare quando la tappa sarà conclusa.`;
}

/** The sections of the confirmation, as text. */
export function testiEffetti(effetti: EffettiCambio): {
  iscrizioni: string[];
  punti: string[];
  bloccanti: string[];
} {
  const { da, a } = effetti;
  return {
    iscrizioni:
      effetti.iscrizioni.length === 0
        ? ["Nessuna iscrizione a tappe future da spostare."]
        : effetti.iscrizioni.map((i) => testoIscrizione(i, da, a)),
    punti:
      !da || effetti.punti.length === 0
        ? ["Nessun punto in classifica generale da spostare."]
        : effetti.punti.map((s) => testoPunti(s, da, a)),
    bloccanti: effetti.bloccanti.map(testoBloccante),
  };
}

/** «Categoria di Luca Rossi cambiata in Femminile. 2 iscrizioni spostate.» */
export function messaggioCambio(
  nome: string,
  a: Categoria,
  spostate: number,
): string {
  const iscrizioni =
    spostate === 0
      ? ""
      : ` ${plurale(spostate, "iscrizione spostata", "iscrizioni spostate")} nel tabellone ${categoriaMinuscola(a)}.`;
  return `Categoria di ${nome} cambiata in ${CATEGORIA_LABEL[a]}.${iscrizioni}`;
}
