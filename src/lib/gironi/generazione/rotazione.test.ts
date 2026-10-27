import { describe, expect, it } from "vitest";
import {
  componiGironi,
  incontri,
  mescola,
  nomeGirone,
  partiteGirone,
  sorteggiaGironi,
} from "./rotazione";

const giocatori = (n: number) =>
  Array.from({ length: n }, (_, i) => `g${i + 1}`);

/** Deterministic pseudo-random sequence for repeatable draws. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

describe("partiteGirone", () => {
  it("genera A+B v C+D, A+C v B+D, A+D v B+C", () => {
    expect(partiteGirone(["A", "B", "C", "D"])).toEqual([
      { turno: 1, squadraA: ["A", "B"], squadraB: ["C", "D"] },
      { turno: 2, squadraA: ["A", "C"], squadraB: ["B", "D"] },
      { turno: 3, squadraA: ["A", "D"], squadraB: ["B", "C"] },
    ]);
  });

  it("ognuno fa coppia una volta con ciascuno e lo affronta due volte", () => {
    const girone = ["A", "B", "C", "D"];
    const { compagni, avversari } = incontri(partiteGirone(girone));
    for (const io of girone) {
      for (const altro of girone.filter((g) => g !== io)) {
        expect(compagni.get(io)?.get(altro)).toBe(1);
        expect(avversari.get(io)?.get(altro)).toBe(2);
      }
      expect(compagni.get(io)?.has(io)).toBe(false);
      expect(avversari.get(io)?.has(io)).toBe(false);
    }
  });

  it("ognuno gioca tutte e tre le partite", () => {
    for (const partita of partiteGirone(["A", "B", "C", "D"])) {
      expect(new Set([...partita.squadraA, ...partita.squadraB]).size).toBe(4);
    }
  });

  it("rifiuta un girone che non è da 4", () => {
    expect(() => partiteGirone(["A", "B", "C"])).toThrow();
  });
});

describe("componiGironi", () => {
  it.each([
    [0, 0, 0],
    [3, 0, 3],
    [4, 1, 0],
    [5, 1, 1],
    [7, 1, 3],
    [8, 2, 0],
    [10, 2, 2],
    [16, 4, 0],
    [33, 8, 1],
  ])("%i iscritti → %i gironi, %i esclusi", (n, gironi, esclusi) => {
    const esito = componiGironi(giocatori(n));
    expect(esito.gironi).toHaveLength(gironi);
    expect(esito.esclusi).toHaveLength(esclusi);
    for (const girone of esito.gironi) expect(girone).toHaveLength(4);
  });

  it("segue l'ordine dato: chi resta fuori sono gli ultimi", () => {
    expect(componiGironi(giocatori(6))).toEqual({
      gironi: [["g1", "g2", "g3", "g4"]],
      esclusi: ["g5", "g6"],
    });
  });
});

describe("sorteggiaGironi", () => {
  it.each([4, 9, 15, 32, 50])(
    "con %i iscritti nessuno sta in due gironi e nessuno si perde",
    (n) => {
      const iscritti = giocatori(n);
      const { gironi, esclusi } = sorteggiaGironi(iscritti, seeded(n));
      const tutti = [...gironi.flat(), ...esclusi];
      expect(new Set(tutti).size).toBe(tutti.length);
      expect([...tutti].sort()).toEqual([...iscritti].sort());
      expect(esclusi).toHaveLength(n % 4);
    },
  );

  it("in ogni girone sorteggiato vale la regola compagni/avversari", () => {
    const { gironi } = sorteggiaGironi(giocatori(24), seeded(7));
    for (const girone of gironi) {
      const { compagni, avversari } = incontri(partiteGirone(girone));
      for (const io of girone)
        for (const altro of girone.filter((g) => g !== io)) {
          expect(compagni.get(io)?.get(altro)).toBe(1);
          expect(avversari.get(io)?.get(altro)).toBe(2);
        }
    }
  });

  it("il sorteggio cambia l'ordine e non tocca l'input", () => {
    const iscritti = giocatori(12);
    const mescolati = mescola(iscritti, seeded(3));
    expect(mescolati).not.toEqual(iscritti);
    expect(iscritti).toEqual(giocatori(12));
  });
});

describe("nomeGirone", () => {
  it("usa le lettere e poi i numeri", () => {
    expect(nomeGirone(1)).toBe("Girone A");
    expect(nomeGirone(26)).toBe("Girone Z");
    expect(nomeGirone(27)).toBe("Girone 27");
  });
});
