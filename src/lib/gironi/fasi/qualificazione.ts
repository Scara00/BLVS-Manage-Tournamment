import type { Categoria, FaseGirone } from "@/lib/db/types";
import { puoAvanzare, type ClassificaGirone } from "@/lib/gironi/classifica";
import { GIRONE_MISTO_DIMENSIONE, uominiDonne } from "@/lib/tappe/formato";
import { prossimoNomeGirone } from "./fase";
import {
  REGOLA_FINALI,
  REGOLA_FINALI_MISTA,
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
  /** Player categories by registration id: needed on a mixed board. */
  categorie?: Readonly<Record<string, Categoria>>;
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

/** A player the admin may pick for a mixed final. */
export type CandidatoFinale = GiocatoreProposto & {
  categoria: Categoria;
  /** «2 vittorie · +12»: the group standing, to help the choice. */
  dettaglio: string;
};

/**
 * A mixed final the admin composes by hand (more gold or silver groups than
 * a final can take one man and one woman from): pick `perCategoria` men
 * and as many women among `candidati`, the players of that colour.
 */
export type FinaleDaComporre = {
  fase: "finale_gold" | "finale_silver";
  nome: string;
  perCategoria: number;
  candidati: CandidatoFinale[];
};

/**
 * The proposal for the next phase: blocked while a group still misses a
 * score (`in_corso`) or has an open perfect tie (`parita`), refused when
 * the groups can't make the next phase (`non_componibile`). A mixed board
 * with too many groups for an automatic final asks the admin (`manuale`).
 */
export type EsitoProposta =
  | { esito: "in_corso"; gironi: GironeDaSistemare[] }
  | { esito: "parita"; gironi: GironeDaSistemare[] }
  | { esito: "non_componibile"; messaggio: string }
  | { esito: "manuale"; finali: FinaleDaComporre[] }
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
  { misto = false }: OpzioniProposta = {},
): EsitoProposta {
  if (iniziali.length === 0) {
    return {
      esito: "non_componibile",
      messaggio: "Il tabellone non ha gironi iniziali.",
    };
  }
  const bloccato = blocco(iniziali);
  if (bloccato) return bloccato;
  if (misto) return proponiGoldSilverMisto(iniziali);

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
 * `giocatori` (1, 2 or 4 groups for a final of 4). Without a rule, a mixed
 * board uses `REGOLA_FINALI_MISTA` (finals of 4 men + 4 women).
 */
export function proponiFinali(
  gironi: readonly GironeClassificato[],
  regolaData?: RegolaFinali,
  { misto = false }: OpzioniProposta = {},
): EsitoProposta {
  const bloccato = blocco(gironi);
  if (bloccato) return bloccato;
  if (misto) {
    return proponiFinaliMiste(gironi, regolaData ?? REGOLA_FINALI_MISTA);
  }
  const regola = regolaData ?? REGOLA_FINALI;

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

// ---------------------------------------------------------------------------
// Mixed board (King & Queen misto): groups of 4 men + 4 women
// ---------------------------------------------------------------------------

/** Options of the proposals: a mixed board ranks men and women apart. */
export type OpzioniProposta = { misto?: boolean };

const ORDINALE: Record<Categoria, (n: number) => string> = {
  M: (n) => (n === 1 ? "Miglior uomo" : `${n}° uomo`),
  F: (n) => (n === 1 ? "Miglior donna" : `${n}ª donna`),
};

/** «Miglior uomo · Girone A», «2ª donna · Girone B». */
export function provenienzaMista(
  categoria: Categoria,
  posizione: number,
  girone: string,
): string {
  return `${ORDINALE[categoria](posizione)} · ${girone}`;
}

/**
 * The player of `categoria` at `posizione` among that category in the
 * group's standing (1 = the best man, or the best woman). The overall
 * order is kept: on a mixed board men only compete with men for a place,
 * women with women.
 */
function alPostoMisto(
  girone: GironeClassificato,
  categoria: Categoria,
  posizione: number,
): GiocatoreProposto[] {
  const righe = girone.classifica!.righe.filter(
    (r) => girone.categorie?.[r.iscrizioneId] === categoria,
  );
  const riga = righe[posizione - 1];
  if (!riga) return [];
  return [
    {
      iscrizioneId: riga.iscrizioneId,
      nome: girone.nomi[riga.iscrizioneId] ?? riga.iscrizioneId,
      provenienza: provenienzaMista(categoria, posizione, girone.nome),
    },
  ];
}

/**
 * Mixed gold and silver groups: the best 2 men and the best 2 women of
 * every initial group go to gold, the other 2 + 2 to silver. Each new
 * group is 4 men + 4 women: the men are composed like the classic groups
 * (`componiGironi` on the 1st and the 2nd), and so are the women, so with
 * 4 initial groups each one sends one man and one woman to every gold
 * group. An odd number of initial groups leaves a last group of 2 + 2,
 * which the admin completes in the editor.
 */
function proponiGoldSilverMisto(
  iniziali: readonly GironeClassificato[],
): EsitoProposta {
  const proposti: GironeProposto[] = [];
  for (const [fase, primo, secondo] of [
    ["gold", 1, 2],
    ["silver", 3, 4],
  ] as const) {
    const [uomini, donne] = (["M", "F"] as const).map((categoria) =>
      componiGironi(
        iniziali.flatMap((g) => alPostoMisto(g, categoria, primo)),
        iniziali.flatMap((g) => alPostoMisto(g, categoria, secondo)),
      ),
    );
    for (let k = 0; k < Math.max(uomini.length, donne.length); k += 1) {
      proposti.push({
        fase,
        nome: prossimoNomeGirone(proposti, fase),
        giocatori: [...(uomini[k] ?? []), ...(donne[k] ?? [])],
      });
    }
  }
  return {
    esito: "ok",
    gironi: proposti,
    avvisi: avvisiDimensione(proposti, GIRONE_MISTO_DIMENSIONE),
  };
}

/**
 * Mixed finals: one group of `giocatori` (half men, half women) per
 * colour. With n groups of a colour each sends its best `giocatori/2/n`
 * men and as many women, so n must divide `giocatori/2` (1, 2 or 4 groups
 * for a final of 4 + 4).
 */
const COLORI_FINALI = [
  ["gold", "finale_gold", "Finale gold"],
  ["silver", "finale_silver", "Finale silver"],
] as const;

/** «2 vittorie · +12», «1 vittoria · −3». */
function dettaglioCandidato(riga: {
  vinte: number;
  differenza: number;
}): string {
  const vittorie = riga.vinte === 1 ? "1 vittoria" : `${riga.vinte} vittorie`;
  const diff =
    riga.differenza > 0
      ? `+${riga.differenza}`
      : riga.differenza < 0
        ? `−${-riga.differenza}`
        : "0";
  return `${vittorie} · ${diff}`;
}

/**
 * Every player of the groups of one colour, as candidates for its final:
 * men first, then women; within each, the best of every group first (in
 * group order), then the second ones.
 */
function candidatiFinale(
  delColore: readonly GironeClassificato[],
): CandidatoFinale[] {
  const candidati: CandidatoFinale[] = [];
  for (const categoria of ["M", "F"] as const) {
    const perGirone = delColore.map((g) =>
      g.classifica!.righe.filter(
        (r) => g.categorie?.[r.iscrizioneId] === categoria,
      ),
    );
    const posti = Math.max(0, ...perGirone.map((r) => r.length));
    for (let i = 0; i < posti; i += 1) {
      delColore.forEach((g, k) => {
        const riga = perGirone[k][i];
        if (!riga) return;
        candidati.push({
          iscrizioneId: riga.iscrizioneId,
          nome: g.nomi[riga.iscrizioneId] ?? riga.iscrizioneId,
          provenienza: provenienzaMista(categoria, i + 1, g.nome),
          categoria,
          dettaglio: dettaglioCandidato(riga),
        });
      });
    }
  }
  return candidati;
}

/**
 * Checks the admin's picks for the mixed finals: per final exactly
 * `perCategoria` men and women among its candidates, nobody twice. Returns
 * the finals to save, or the first problem in words.
 */
export function verificaSceltaFinali(
  finali: readonly FinaleDaComporre[],
  scelta: Readonly<
    Partial<Record<FinaleDaComporre["fase"], readonly string[]>>
  >,
): { ok: true; gironi: GironeProposto[] } | { ok: false; messaggio: string } {
  const gironi: GironeProposto[] = [];
  const visti = new Set<string>();
  for (const finale of finali) {
    const ids = scelta[finale.fase] ?? [];
    const per = new Map(finale.candidati.map((c) => [c.iscrizioneId, c]));
    const scelti = ids.map((id) => per.get(id));
    if (scelti.some((c) => c === undefined)) {
      return {
        ok: false,
        messaggio: `${finale.nome}: un giocatore scelto non arriva dai suoi gironi.`,
      };
    }
    const giocatori = scelti as CandidatoFinale[];
    for (const categoria of ["M", "F"] as const) {
      const n = giocatori.filter((c) => c.categoria === categoria).length;
      if (n !== finale.perCategoria) {
        return {
          ok: false,
          messaggio: `${finale.nome}: scegli ${uominiDonne(finale.perCategoria, finale.perCategoria)}.`,
        };
      }
    }
    for (const c of giocatori) {
      if (visti.has(c.iscrizioneId)) {
        return {
          ok: false,
          messaggio: `${c.nome} è scelto due volte.`,
        };
      }
      visti.add(c.iscrizioneId);
    }
    gironi.push({
      fase: finale.fase,
      nome: finale.nome,
      giocatori: [...giocatori]
        .sort((a, b) =>
          a.categoria === b.categoria ? 0 : a.categoria === "M" ? -1 : 1,
        )
        .map(({ iscrizioneId, nome, provenienza }) => ({
          iscrizioneId,
          nome,
          provenienza,
        })),
    });
  }
  return { ok: true, gironi };
}

function proponiFinaliMiste(
  gironi: readonly GironeClassificato[],
  regola: RegolaFinali,
): EsitoProposta {
  const perCategoria = regola.giocatori / 2;
  // More groups of a colour than a final takes one man and one woman
  // from: the admin picks the finalists (both finals, for consistency).
  const manuale = COLORI_FINALI.some(([colore]) => {
    const n = gironi.filter((g) => g.fase === colore).length;
    return n > 0 && perCategoria % n !== 0;
  });
  if (manuale) {
    return {
      esito: "manuale",
      finali: COLORI_FINALI.flatMap(([colore, fase, nome]) => {
        const delColore = gironi.filter((g) => g.fase === colore);
        return delColore.length === 0
          ? []
          : [
              {
                fase,
                nome,
                perCategoria,
                candidati: candidatiFinale(delColore),
              },
            ];
      }),
    };
  }
  const finali: GironeProposto[] = [];
  for (const [colore, fase, nome] of COLORI_FINALI) {
    const delColore = gironi.filter((g) => g.fase === colore);
    if (delColore.length === 0) continue;
    const perGirone = perCategoria / delColore.length;
    const giocatori: GiocatoreProposto[] = [];
    for (const categoria of ["M", "F"] as const) {
      for (let posizione = 1; posizione <= perGirone; posizione += 1) {
        for (const g of delColore) {
          giocatori.push(...alPostoMisto(g, categoria, posizione));
        }
      }
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
