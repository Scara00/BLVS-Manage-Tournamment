import { describe, expect, it } from "vitest";
import {
  classificaGirone,
  firmaParita,
  paritaPerfette,
  puoAvanzare,
  statisticheGirone,
  type PartitaGirone,
} from "./classifica";

const categorie = { m1: "M", m2: "M", f1: "F", f2: "F" } as const;
const iscrizioni = ["m1", "f1", "m2", "f2"];

function partita(
  id: string,
  a: [string, string],
  b: [string, string],
  set: [number, number],
): PartitaGirone {
  return {
    id,
    stato: "conclusa",
    squadre: { A: a, B: b },
    sets: [{ a: set[0], b: set[1] }],
  };
}

describe("classificaGirone nel misto: uomini e donne a parte", () => {
  // m1 e f1 giocano sempre insieme e vincono: identici in tutto.
  const insieme = [
    partita("p1", ["m1", "f1"], ["m2", "f2"], [21, 15]),
    partita("p2", ["m1", "f1"], ["m2", "f2"], [21, 18]),
  ];

  it("una parità tra un uomo e una donna non blocca: hanno posti diversi", () => {
    const unica = classificaGirone(iscrizioni, insieme);
    expect(unica.stato).toBe("da_risolvere");

    const mista = classificaGirone(iscrizioni, insieme, { categorie });
    expect(mista.stato).toBe("completo");
    expect(puoAvanzare(mista)).toBe(true);
    expect(mista.parita).toEqual([]);
    expect(
      mista.righe.map((r) => [r.iscrizioneId, r.categoria, r.posizione]),
    ).toEqual([
      ["m1", "M", 1],
      ["m2", "M", 2],
      ["f1", "F", 1],
      ["f2", "F", 2],
    ]);
  });

  it("una parità tra due uomini resta da risolvere, con la sua categoria", () => {
    // m1 e m2 si dividono gli scontri diretti: identici.
    const pari = [
      partita("p1", ["m1", "f1"], ["m2", "f2"], [21, 15]),
      partita("p2", ["m1", "f2"], ["m2", "f1"], [15, 21]),
    ];
    const classifica = classificaGirone(iscrizioni, pari, { categorie });
    expect(classifica.stato).toBe("da_risolvere");
    expect(classifica.parita).toEqual([
      expect.objectContaining({
        iscrizioni: ["m1", "m2"],
        categoria: "M",
        posizione: 1,
      }),
    ]);
    expect(paritaPerfette(iscrizioni, pari, undefined, categorie)).toEqual(
      classifica.parita,
    );

    // La decisione dell'admin su quella parità vale come sempre.
    const firma = firmaParita(
      statisticheGirone(iscrizioni, pari).filter((s) =>
        ["m1", "m2"].includes(s.iscrizioneId),
      ),
    );
    const decisa = classificaGirone(iscrizioni, pari, {
      categorie,
      decisioni: [{ firma, ordine: ["m2", "m1"] }],
    });
    expect(decisa.stato).toBe("completo");
    expect(
      decisa.righe
        .filter((r) => r.categoria === "M")
        .map((r) => [r.iscrizioneId, r.posizione, r.decisoDa]),
    ).toEqual([
      ["m2", 1, "admin"],
      ["m1", 2, "admin"],
    ]);
  });

  it("senza categorie la classifica è quella di sempre", () => {
    const unica = classificaGirone(iscrizioni, insieme);
    expect(unica.righe.every((r) => r.categoria === undefined)).toBe(true);
    expect(unica.righe.map((r) => r.posizione)).toEqual([1, 1, 3, 3]);
  });
});
