/**
 * w-regole (BLVS-46, R-40/41/42/46): the rules page text, generated from
 * the circuit's configuration. Nothing here is copied: change a rule in
 * its own module and the page follows.
 */
import {
  REGOLA_GENERALE,
  spiegaRegolaGenerale,
  type RegolaGenerale,
} from "@/lib/classifica-generale/spareggi";
import type { FaseGioco, FaseTabellone } from "@/lib/db/types";
import {
  REGOLA_CLASSIFICA,
  spiegaRegolaClassifica,
  type RegolaClassifica,
} from "@/lib/gironi/classifica/criteri";
import { FASE_GIOCO_LABEL } from "@/lib/gironi/fasi/fase";
import {
  REGOLA_FINALI,
  REGOLA_QUALIFICAZIONE,
  type RegolaFinali,
  type RegolaQualificazione,
} from "@/lib/gironi/fasi/regole";
import { ROTAZIONE_GIRONE } from "@/lib/gironi/generazione/rotazione";
import {
  REGOLA_SET,
  spiegaRegolaSet,
  type RegolaSet,
} from "@/lib/punteggi/regola";
import { REGOLA_AVVIO, ROTAZIONE_MISTA } from "@/lib/tappe/avvio/regole";
import { PUNTI_PER_POSIZIONE } from "@/lib/tappe/classifica/punti";
import {
  REGOLE_APERTE,
  daConfermare,
  type DomandaAperta,
  type SezioneRegole,
} from "./aperte";

export type ConfigRegole = {
  /** Players per group (initial groups). */
  giocatoriGirone: number;
  /** Matches each group plays (King/Queen rotation). */
  partiteGirone: number;
  qualificazione: RegolaQualificazione;
  finali: RegolaFinali;
  set: RegolaSet;
  classifica: RegolaClassifica;
  punti: Readonly<Record<FaseTabellone, readonly number[]>>;
  generale: RegolaGenerale;
  aperte: Readonly<Partial<Record<DomandaAperta, SezioneRegole>>>;
};

export const CONFIG_REGOLE: ConfigRegole = {
  giocatoriGirone: REGOLA_AVVIO.dimensione,
  partiteGirone: ROTAZIONE_GIRONE.length,
  qualificazione: REGOLA_QUALIFICAZIONE,
  finali: REGOLA_FINALI,
  set: REGOLA_SET,
  classifica: REGOLA_CLASSIFICA,
  punti: PUNTI_PER_POSIZIONE,
  generale: REGOLA_GENERALE,
  aperte: REGOLE_APERTE,
};

export type PassoFormato = {
  id: FaseGioco;
  numero: number;
  titolo: string;
  testo: string;
};

export type RigaPunti = {
  posizione: number;
  gold: number;
  silver: number;
};

export type Sezione<T> = { daConfermare: boolean; contenuto: T };

export type RegoleCircuito = {
  formato: Sezione<PassoFormato[]>;
  /** The mixed King & Queen stage: how it differs from the classic one. */
  misto: Sezione<string[]>;
  set: Sezione<string>;
  spareggiGirone: Sezione<string[]>;
  punti: Sezione<RigaPunti[]>;
  spareggiGenerale: Sezione<string[]>;
};

/** «1°», «1° o 2°», «1°, 2° o 3°». */
export function elencoPosti(
  posti: readonly number[],
  congiunzione = "o",
): string {
  const voci = posti.map((p) => `${p}°`);
  if (voci.length <= 1) return voci.join("");
  return `${voci.slice(0, -1).join(", ")} ${congiunzione} ${voci.at(-1)}`;
}

function passiFormato(c: ConfigRegole): PassoFormato[] {
  const { gold, silver } = c.qualificazione;
  const testi: Record<FaseGioco, string> = {
    gironi_iniziali: `Gli iscritti vengono sorteggiati in gironi da ${c.giocatoriGirone} giocatori. Ogni girone gioca ${c.partiteGirone} partite King/Queen: a ogni partita si cambia compagno, così ognuno gioca con tutti gli altri del girone.`,
    gironi_gold_silver: `Chi arriva ${elencoPosti(gold)} nel girone iniziale va nei gironi Gold; chi arriva ${elencoPosti(silver)} va nei gironi Silver. Anche questi sono gironi King/Queen.`,
    finali: `I migliori di ogni girone Gold giocano la finale Gold, quelli dei gironi Silver la finale Silver: ogni finale è un girone King/Queen da ${c.finali.giocatori} giocatori.`,
  };
  return (["gironi_iniziali", "gironi_gold_silver", "finali"] as const).map(
    (id, i) => ({
      id,
      numero: i + 1,
      titolo: FASE_GIOCO_LABEL[id],
      testo: testi[id],
    }),
  );
}

/** The mixed King & Queen stage, paragraph by paragraph. */
export function regoleMisto(c: ConfigRegole = CONFIG_REGOLE): string[] {
  const meta = c.giocatoriGirone / 2;
  return [
    "Alcune tappe sono King & Queen misto: un solo tabellone dove ogni squadra è sempre un uomo e una donna. Il numero massimo di giocatori è diviso a metà, metà posti agli uomini e metà alle donne.",
    `I gironi sono da ${meta} uomini e ${meta} donne e giocano ${ROTAZIONE_MISTA.length} partite: a ogni partita si cambia compagno, così ognuno fa coppia una volta con ciascuno dei due giocatori dell'altra categoria.`,
    "Le fasi sono le stesse: il miglior uomo e la miglior donna di ogni girone iniziale vanno nei gironi Gold, gli altri due nei Silver; poi le finali Gold e Silver, sempre metà uomini e metà donne. Fino a 2 gironi per colore in finale vanno il miglior uomo e la miglior donna di ogni girone; con più gironi i finalisti li sceglie l'organizzazione.",
    "La tappa mista ha la sua classifica ma non assegna punti alla classifica generale.",
  ];
}

function righePunti(punti: ConfigRegole["punti"]): RigaPunti[] {
  const posti = Math.max(punti.gold.length, punti.silver.length);
  return Array.from({ length: posti }, (_, i) => ({
    posizione: i + 1,
    gold: punti.gold[i] ?? 0,
    silver: punti.silver[i] ?? 0,
  }));
}

/** The whole rules page, from `config` (the circuit's by default). */
export function regoleDelCircuito(
  config: ConfigRegole = CONFIG_REGOLE,
): RegoleCircuito {
  const aperta = (s: SezioneRegole) => daConfermare(s, config.aperte);
  return {
    formato: {
      daConfermare: aperta("formato"),
      contenuto: passiFormato(config),
    },
    misto: {
      daConfermare: aperta("formato"),
      contenuto: regoleMisto(config),
    },
    set: {
      daConfermare: aperta("set"),
      contenuto: spiegaRegolaSet(config.set),
    },
    spareggiGirone: {
      daConfermare: aperta("spareggi_girone"),
      contenuto: spiegaRegolaClassifica(config.classifica),
    },
    punti: {
      daConfermare: aperta("punti"),
      contenuto: righePunti(config.punti),
    },
    spareggiGenerale: {
      daConfermare: aperta("spareggi_generale"),
      contenuto: spiegaRegolaGenerale(config.generale),
    },
  };
}

/** Every match of every phase is one set (R-32). */
export const TESTO_UN_SET = "Ogni partita si gioca su un solo set.";

/** Short intro of the points table. */
export function introPunti(righe: readonly RigaPunti[]): string {
  const primo = righe[0] ?? { gold: 0, silver: 0 };
  return `I punti di tappa vanno ai giocatori delle due finali, in base alla posizione: chi vince la finale Gold prende ${primo.gold} punti, chi vince la finale Silver ${primo.silver}. Chi esce prima delle finali non prende punti.`;
}
