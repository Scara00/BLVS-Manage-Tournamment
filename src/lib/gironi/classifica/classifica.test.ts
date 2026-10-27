import { describe, expect, it } from "vitest";
import type { StatoPartita } from "@/lib/db/types";
import {
  classificaGirone,
  firmaParita,
  iscrizioniDellaFirma,
  ordineValido,
  puoAvanzare,
  statisticheGirone,
  vincitorePartita,
  type PartitaGirone,
  type RigaClassifica,
} from "./classifica";
import type { CriterioSpareggio } from "./criteri";

const GIOCATORI = ["a", "b", "c", "d"];

let seq = 0;

/** A match; `x-y` scores are A-B per set. */
function partita(
  A: string[],
  B: string[],
  punteggi: string,
  stato: StatoPartita = "conclusa",
): PartitaGirone {
  const sets = punteggi
    ? punteggi.split(" ").map((set) => {
        const [a, b] = set.split("-").map(Number);
        return { a, b };
      })
    : [];
  return { id: `p${++seq}`, stato, squadre: { A, B }, sets };
}

/** One-against-one match, `x` beats or loses to `y` with the given score. */
const uno = (x: string, y: string, punteggi: string, stato?: StatoPartita) =>
  partita([x], [y], punteggi, stato);

type Atteso = [
  id: string,
  posizione: number,
  decisoDa: RigaClassifica["decisoDa"],
];

function riassunto(righe: RigaClassifica[]): Atteso[] {
  return righe.map((r) => [r.iscrizioneId, r.posizione, r.decisoDa]);
}

// Each case is a full round robin among a, b, c, d unless stated.
const CASI: {
  nome: string;
  partite: PartitaGirone[];
  atteso: Atteso[];
  criteri?: CriterioSpareggio[];
}[] = [
  {
    nome: "ordine netto per vittorie",
    partite: [
      uno("a", "b", "21-10"),
      uno("a", "c", "21-10"),
      uno("a", "d", "21-10"),
      uno("b", "c", "21-10"),
      uno("b", "d", "21-10"),
      uno("c", "d", "21-10"),
    ],
    atteso: [
      ["a", 1, "vittorie"],
      ["b", 2, "vittorie"],
      ["c", 3, "vittorie"],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "parità a due decisa dallo scontro diretto, prima della differenza",
    partite: [
      uno("a", "b", "21-19"),
      uno("a", "d", "21-19"),
      uno("c", "a", "21-10"),
      uno("b", "c", "21-5"),
      uno("b", "d", "21-5"),
      uno("d", "c", "21-19"),
    ],
    // a and b: 2 wins; b has the better difference, a won the match.
    atteso: [
      ["a", 1, "scontro_diretto"],
      ["b", 2, "scontro_diretto"],
      ["d", 3, "scontro_diretto"],
      ["c", 4, "scontro_diretto"],
    ],
  },
  {
    nome: "stessa parità con la differenza prima dello scontro diretto",
    criteri: ["vittorie", "differenza_punti", "scontro_diretto", "punti_fatti"],
    partite: [
      uno("a", "b", "21-19"),
      uno("a", "d", "21-19"),
      uno("c", "a", "21-10"),
      uno("b", "c", "21-5"),
      uno("b", "d", "21-5"),
      uno("d", "c", "21-19"),
    ],
    atteso: [
      ["b", 1, "differenza_punti"],
      ["a", 2, "differenza_punti"],
      ["c", 3, "differenza_punti"],
      ["d", 4, "differenza_punti"],
    ],
  },
  {
    nome: "parità a due decisa dalla differenza (scontro diretto annullato)",
    partite: [
      uno("a", "b", "21-10", "annullata"),
      uno("a", "c", "21-10"),
      uno("a", "d", "21-15"),
      uno("b", "c", "21-18"),
      uno("b", "d", "21-19"),
      uno("c", "d", "21-15"),
    ],
    atteso: [
      ["a", 1, "differenza_punti"],
      ["b", 2, "differenza_punti"],
      ["c", 3, "vittorie"],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "differenza pari, decidono i punti fatti",
    partite: [
      uno("a", "b", "21-10", "annullata"),
      uno("a", "c", "21-15"),
      uno("a", "d", "21-19"),
      uno("b", "c", "25-20"),
      uno("b", "d", "23-20"),
      uno("c", "d", "21-15"),
    ],
    atteso: [
      ["b", 1, "punti_fatti"],
      ["a", 2, "punti_fatti"],
      ["c", 3, "vittorie"],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "parità a tre circolare, decide la differenza",
    partite: [
      uno("a", "b", "21-19"),
      uno("b", "c", "21-19"),
      uno("c", "a", "21-19"),
      uno("a", "d", "21-5"),
      uno("b", "d", "21-10"),
      uno("c", "d", "21-15"),
    ],
    atteso: [
      ["a", 1, "differenza_punti"],
      ["b", 2, "differenza_punti"],
      ["c", 3, "differenza_punti"],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "parità a tre che scende a due: lo scontro diretto si ricalcola",
    partite: [
      uno("a", "b", "21-19"),
      uno("b", "c", "21-19"),
      uno("c", "a", "21-19"),
      uno("a", "d", "21-10"),
      uno("b", "d", "21-15"),
      uno("c", "d", "21-15"),
    ],
    // a: best difference; b and c level on everything but their match.
    atteso: [
      ["a", 1, "differenza_punti"],
      ["b", 2, "scontro_diretto"],
      ["c", 3, "scontro_diretto"],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "parità perfetta a due",
    partite: [
      uno("a", "b", "21-10", "annullata"),
      uno("a", "c", "21-15"),
      uno("b", "c", "21-15"),
      uno("d", "a", "21-15"),
      uno("d", "b", "21-15"),
      uno("d", "c", "21-0"),
    ],
    atteso: [
      ["d", 1, "vittorie"],
      ["a", 2, null],
      ["b", 2, null],
      ["c", 4, "vittorie"],
    ],
  },
  {
    nome: "parità perfetta a tre",
    partite: [
      uno("a", "b", "21-19"),
      uno("b", "c", "21-19"),
      uno("c", "a", "21-19"),
      uno("a", "d", "21-15"),
      uno("b", "d", "21-15"),
      uno("c", "d", "21-15"),
    ],
    atteso: [
      ["a", 1, null],
      ["b", 1, null],
      ["c", 1, null],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "vince chi ha più set, anche con meno punti",
    partite: [
      uno("a", "b", "21-15 10-21 15-13"),
      uno("a", "c", "21-10"),
      uno("a", "d", "21-10"),
      uno("b", "c", "21-10"),
      uno("b", "d", "21-10"),
      uno("c", "d", "21-10"),
    ],
    atteso: [
      ["a", 1, "vittorie"],
      ["b", 2, "vittorie"],
      ["c", 3, "vittorie"],
      ["d", 4, "vittorie"],
    ],
  },
  {
    nome: "King of the court (2 contro 2, coppie a rotazione)",
    partite: [
      partita(["a", "b"], ["c", "d"], "21-15"),
      partita(["a", "c"], ["b", "d"], "21-18"),
      partita(["a", "d"], ["b", "c"], "21-19"),
    ],
    // a: 3 wins; b, c, d: 1 each, one head-to-head win each, then difference.
    atteso: [
      ["a", 1, "vittorie"],
      ["b", 2, "differenza_punti"],
      ["c", 3, "differenza_punti"],
      ["d", 4, "differenza_punti"],
    ],
  },
];

describe("classificaGirone", () => {
  it.each(CASI)("$nome", ({ partite, atteso, criteri }) => {
    const classifica = classificaGirone(
      GIOCATORI,
      partite,
      criteri ? { regola: { criteri } } : {},
    );
    expect(riassunto(classifica.righe)).toEqual(atteso);
    const pari = atteso.filter(([, , decisoDa]) => decisoDa === null);
    expect(classifica.parita.flatMap((p) => p.iscrizioni)).toEqual(
      pari.map(([id]) => id),
    );
    expect(classifica.stato).toBe(pari.length ? "da_risolvere" : "completo");
    expect(puoAvanzare(classifica)).toBe(pari.length === 0);
  });

  it("calcola giocate, vittorie, punti fatti, subiti e differenza", () => {
    const stats = statisticheGirone(GIOCATORI, [
      partita(["a", "b"], ["c", "d"], "21-15 18-21 15-10"),
      partita(["a", "c"], ["b", "d"], "21-18"),
    ]);
    expect(stats).toEqual([
      {
        iscrizioneId: "a",
        giocate: 2,
        vinte: 2,
        puntiFatti: 75,
        puntiSubiti: 64,
        differenza: 11,
      },
      {
        iscrizioneId: "b",
        giocate: 2,
        vinte: 1,
        puntiFatti: 72,
        puntiSubiti: 67,
        differenza: 5,
      },
      {
        iscrizioneId: "c",
        giocate: 2,
        vinte: 1,
        puntiFatti: 67,
        puntiSubiti: 72,
        differenza: -5,
      },
      {
        iscrizioneId: "d",
        giocate: 2,
        vinte: 0,
        puntiFatti: 64,
        puntiSubiti: 75,
        differenza: -11,
      },
    ]);
  });

  it("conta solo le partite concluse con un vincitore", () => {
    expect(vincitorePartita(uno("a", "b", "21-10", "in_corso"))).toBeNull();
    expect(vincitorePartita(uno("a", "b", "21-10", "programmata"))).toBeNull();
    expect(vincitorePartita(uno("a", "b", "21-10", "annullata"))).toBeNull();
    expect(vincitorePartita(uno("a", "b", ""))).toBeNull();
    expect(vincitorePartita(uno("a", "b", "21-10 10-21"))).toBeNull();
    expect(vincitorePartita(uno("a", "b", "10-21"))).toBe("B");

    const stats = statisticheGirone(
      ["a", "b"],
      [uno("a", "b", "21-10", "in_corso"), uno("a", "b", "")],
    );
    expect(stats.every((s) => s.giocate === 0)).toBe(true);
  });

  it("è in corso finché manca un punteggio, anche senza parità", () => {
    const partite = [
      uno("a", "b", "21-10"),
      uno("a", "c", "21-10"),
      uno("b", "c", "21-10"),
      uno("a", "d", "", "programmata"),
    ];
    const classifica = classificaGirone(GIOCATORI, partite);
    expect(classifica.stato).toBe("in_corso");
    expect(puoAvanzare(classifica)).toBe(false);
  });

  it("senza partite giocate tutti pari, girone in corso", () => {
    const classifica = classificaGirone(GIOCATORI, [
      uno("a", "b", "", "programmata"),
    ]);
    expect(classifica.righe.map((r) => r.posizione)).toEqual([1, 1, 1, 1]);
    expect(classifica.stato).toBe("in_corso");
    expect(classifica.parita).toHaveLength(1);
  });

  it("ignora i giocatori di una partita che non sono nel girone", () => {
    const stats = statisticheGirone(["a"], [uno("a", "x", "21-10")]);
    expect(stats).toEqual([
      {
        iscrizioneId: "a",
        giocate: 1,
        vinte: 1,
        puntiFatti: 21,
        puntiSubiti: 10,
        differenza: 11,
      },
    ]);
  });
});

describe("decisione dell'admin su una parità perfetta", () => {
  const parita = (puntiC: string) => [
    uno("a", "b", "21-10", "annullata"),
    uno("a", "c", puntiC),
    uno("b", "c", puntiC),
    uno("d", "a", "21-15"),
    uno("d", "b", "21-15"),
    uno("d", "c", "21-0"),
  ];

  it("applica l'ordine deciso e sblocca il girone", () => {
    const prima = classificaGirone(GIOCATORI, parita("21-15"));
    const [{ firma }] = prima.parita;
    const dopo = classificaGirone(GIOCATORI, parita("21-15"), {
      decisioni: [{ firma, ordine: ["b", "a"] }],
    });
    expect(riassunto(dopo.righe)).toEqual([
      ["d", 1, "vittorie"],
      ["b", 2, "admin"],
      ["a", 3, "admin"],
      ["c", 4, "vittorie"],
    ]);
    expect(dopo.parita).toEqual([]);
    expect(dopo.righe.some((r) => r.daRisolvere)).toBe(false);
    expect(puoAvanzare(dopo)).toBe(true);
  });

  it("una correzione che cambia i numeri riapre la parità", () => {
    const { firma } = classificaGirone(GIOCATORI, parita("21-15")).parita[0];
    const corretta = classificaGirone(GIOCATORI, parita("22-20"), {
      decisioni: [{ firma, ordine: ["b", "a"] }],
    });
    expect(corretta.stato).toBe("da_risolvere");
    expect(corretta.parita[0].firma).not.toBe(firma);
    expect(
      corretta.righe.filter((r) => r.daRisolvere).map((r) => r.iscrizioneId),
    ).toEqual(["a", "b"]);
  });

  it("ignora un ordine che non elenca esattamente i giocatori pari", () => {
    const { firma } = classificaGirone(GIOCATORI, parita("21-15")).parita[0];
    for (const ordine of [["a"], ["a", "a"], ["a", "c"], ["a", "b", "c"]]) {
      const classifica = classificaGirone(GIOCATORI, parita("21-15"), {
        decisioni: [{ firma, ordine }],
      });
      expect(classifica.stato).toBe("da_risolvere");
    }
  });

  it("la firma è stabile ed elenca i giocatori pari", () => {
    const {
      parita: [tie],
    } = classificaGirone(GIOCATORI, parita("21-15"));
    expect(tie.firma).toBe("a:2/1/36/36|b:2/1/36/36");
    expect(iscrizioniDellaFirma(tie.firma)).toEqual(["a", "b"]);
    const stats = statisticheGirone(GIOCATORI, parita("21-15"));
    expect(firmaParita([stats[1], stats[0]])).toBe(tie.firma);
  });

  it("ordineValido accetta solo una permutazione del gruppo", () => {
    expect(ordineValido(["b", "a"], ["a", "b"])).toBe(true);
    expect(ordineValido(["a", "a"], ["a", "b"])).toBe(false);
    expect(ordineValido(["a"], ["a", "b"])).toBe(false);
  });
});
