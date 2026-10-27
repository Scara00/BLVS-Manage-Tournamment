import type { FaseGirone } from "@/lib/db/types";
import { puoAvanzare, type ClassificaGirone } from "@/lib/gironi/classifica";
import { prossimoNomeGirone } from "./fase";
import {
  REGOLA_FINALI,
  REGOLA_QUALIFICAZIONE,
  type RegolaFinali,
  type RegolaQualificazione,
} from "./regole";

/** One group of the phase just played, with its standing. */
export type GironeClassificato = {
  id: string;
  nome: string;
  fase: FaseGirone;
  /** Player names by registration id. */
  nomi: Readonly<Record<string, string>>;
  /** Null when the group has no match yet. */
  classifica: ClassificaGirone | null;
};

export type GiocatoreProposto = {
  iscrizioneId: string;
  nome: string;
  /** «1° Girone A»: where the player comes from. */
  provenienza: string;
};

export type GironeProposto = {
  fase: FaseGirone;
  nome: string;
  giocatori: GiocatoreProposto[];
};

export type GironeDaSistemare = { id: string; nome: string };

/**
 * The proposal for the next phase: blocked while a group still misses a
 * score (`in_corso`) or has an open perfect tie (`parita`), refused when
 * the groups can't make the next phase (`non_componibile`).
 */
export type EsitoProposta =
  | { esito: "in_corso"; gironi: GironeDaSistemare[] }
  | { esito: "parita"; gironi: GironeDaSistemare[] }
  | { esito: "non_componibile"; messaggio: string }
  | { esito: "ok"; gironi: GironeProposto[]; avvisi: string[] };

/** «1° Girone A». */
export function provenienza(posizione: number, girone: string): string {
  return `${posizione}° ${girone}`;
}

/** Blocks the proposal until every group can advance (BLVS-27 gate). */
function blocco(
  gironi: readonly GironeClassificato[],
): Extract<EsitoProposta, { esito: "in_corso" | "parita" }> | null {
  const daGiocare = gironi.filter(
    (g) => !g.classifica || g.classifica.stato === "in_corso",
  );
  if (daGiocare.length > 0) {
    return {
      esito: "in_corso",
      gironi: daGiocare.map(({ id, nome }) => ({ id, nome })),
    };
  }
  const parita = gironi.filter((g) => !puoAvanzare(g.classifica!));
  if (parita.length > 0) {
    return {
      esito: "parita",
      gironi: parita.map(({ id, nome }) => ({ id, nome })),
    };
  }
  return null;
}

/** The players of `girone` at `posizione`, in standing order. */
function alPosto(
  girone: GironeClassificato,
  posizione: number,
): GiocatoreProposto[] {
  return girone
    .classifica!.righe.filter((r) => r.posizione === posizione)
    .map((r) => ({
      iscrizioneId: r.iscrizioneId,
      nome: girone.nomi[r.iscrizioneId] ?? r.iscrizioneId,
      provenienza: provenienza(posizione, girone.nome),
    }));
}

/**
 * Groups of 4 from the players of two tiers (e.g. the 1st and the 2nd of
 * every initial group, in group order): group k gets the 1st of groups 2k
 * and 2k+1 and the 2nd of groups 2k+2 and 2k+3 (wrapping round). With 4 or
 * more groups nobody meets a player of their own initial group again; with
 * 2 groups that can't be avoided. An odd number of groups leaves a last
 * group of 2, which the admin completes in the editor.
 */
export function componiGironi<T>(
  primi: readonly T[],
  secondi: readonly T[],
): T[][] {
  const n = secondi.length;
  const ruotati =
    n > 2 ? [...secondi.slice(2), ...secondi.slice(0, 2)] : [...secondi];
  const gironi: T[][] = [];
  for (let k = 0; 2 * k < Math.max(primi.length, ruotati.length); k += 1) {
    gironi.push([
      ...primi.slice(2 * k, 2 * k + 2),
      ...ruotati.slice(2 * k, 2 * k + 2),
    ]);
  }
  return gironi;
}

function avvisiDimensione(
  gironi: readonly GironeProposto[],
  dimensione: number,
): string[] {
  return gironi
    .filter((g) => g.giocatori.length !== dimensione)
    .map(
      (g) =>
        `${g.nome}: ${g.giocatori.length === 1 ? "1 giocatore" : `${g.giocatori.length} giocatori`} invece di ${dimensione}. Completalo nell'editor prima dell'avvio.`,
    );
}

/**
 * Gold and silver groups from the standings of the initial groups (R-28):
 * 1st and 2nd go to gold, 3rd and 4th to silver (`REGOLA_QUALIFICAZIONE`).
 */
export function proponiGoldSilver(
  iniziali: readonly GironeClassificato[],
  regola: RegolaQualificazione = REGOLA_QUALIFICAZIONE,
): EsitoProposta {
  if (iniziali.length === 0) {
    return {
      esito: "non_componibile",
      messaggio: "Il tabellone non ha gironi iniziali.",
    };
  }
  const bloccato = blocco(iniziali);
  if (bloccato) return bloccato;

  const proposti: GironeProposto[] = [];
  for (const fase of ["gold", "silver"] as const) {
    const [primo, secondo] = regola[fase];
    const gruppi = componiGironi(
      iniziali.flatMap((g) => alPosto(g, primo)),
      iniziali.flatMap((g) => alPosto(g, secondo)),
    );
    for (const giocatori of gruppi) {
      proposti.push({
        fase,
        nome: prossimoNomeGirone(proposti, fase),
        giocatori,
      });
    }
  }
  return {
    esito: "ok",
    gironi: proposti,
    avvisi: avvisiDimensione(proposti, 4),
  };
}

/**
 * The gold final and the silver final from the standings of the
 * gold/silver groups (R-29, Q-01): one King/Queen group of
 * `regola.giocatori` per colour, made of the best of each group. With n
 * groups of a colour each sends its first `giocatori / n`, so n must divide
 * `giocatori` (1, 2 or 4 groups for a final of 4).
 */
export function proponiFinali(
  gironi: readonly GironeClassificato[],
  regola: RegolaFinali = REGOLA_FINALI,
): EsitoProposta {
  const bloccato = blocco(gironi);
  if (bloccato) return bloccato;

  const finali: GironeProposto[] = [];
  for (const [colore, fase, nome] of [
    ["gold", "finale_gold", "Finale gold"],
    ["silver", "finale_silver", "Finale silver"],
  ] as const) {
    const delColore = gironi.filter((g) => g.fase === colore);
    if (delColore.length === 0) continue;
    if (regola.giocatori % delColore.length !== 0) {
      return {
        esito: "non_componibile",
        messaggio: `Con ${delColore.length} gironi ${colore} la finale da ${regola.giocatori} non si compone in automatico.`,
      };
    }
    const perGirone = regola.giocatori / delColore.length;
    const giocatori: GiocatoreProposto[] = [];
    for (let posizione = 1; posizione <= perGirone; posizione += 1) {
      for (const g of delColore) giocatori.push(...alPosto(g, posizione));
    }
    if (giocatori.length !== regola.giocatori) {
      return {
        esito: "non_componibile",
        messaggio: `La ${nome.toLowerCase()} avrebbe ${giocatori.length} giocatori invece di ${regola.giocatori}.`,
      };
    }
    finali.push({ fase, nome, giocatori });
  }
  if (finali.length === 0) {
    return {
      esito: "non_componibile",
      messaggio: "Il tabellone non ha gironi gold o silver.",
    };
  }
  return { esito: "ok", gironi: finali, avvisi: [] };
}

/** What the RPCs take: `[{fase, iscrizioni}]`. */
export function proposta(gironi: readonly GironeProposto[]) {
  return gironi.map((g) => ({
    fase: g.fase,
    iscrizioni: g.giocatori.map((p) => p.iscrizioneId),
  }));
}
