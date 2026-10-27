import { describe, expect, it } from "vitest";
import { leggiPunteggio } from "./punteggio";

function leggi(valori: Record<string, string>) {
  return leggiPunteggio((campo) => valori[campo] ?? "");
}

describe("leggiPunteggio", () => {
  it("legge i set compilati, gli ultimi vuoti si ignorano", () => {
    expect(
      leggi({ set1a: "21", set1b: "18", set2a: " 19 ", set2b: "21" }),
    ).toEqual({
      ok: true,
      sets: [
        { a: 21, b: 18 },
        { a: 19, b: 21 },
      ],
    });
  });

  it("serve almeno un set", () => {
    expect(leggi({})).toEqual({
      ok: false,
      errori: { sets: "Scrivi il punteggio di almeno un set." },
    });
  });

  it("segnala ogni set sbagliato", () => {
    const letto = leggi({
      set1a: "21",
      set2a: "100",
      set2b: "3",
      set3a: "15",
      set3b: "15",
    });
    expect(letto).toEqual({
      ok: false,
      errori: {
        set1: "Set 1: scrivi i punti di entrambe le squadre.",
        set2: "Set 2: scrivi punti interi da 0 a 99.",
        set3: "Set 3: un set non può finire in parità.",
      },
    });
  });

  it("rifiuta numeri non interi o negativi", () => {
    expect(leggi({ set1a: "-1", set1b: "21" }).ok).toBe(false);
    expect(leggi({ set1a: "2.5", set1b: "21" }).ok).toBe(false);
  });

  it("non lascia buchi tra i set", () => {
    expect(
      leggi({ set1a: "21", set1b: "18", set3a: "15", set3b: "10" }),
    ).toEqual({
      ok: false,
      errori: { set3: "Set 3: compila prima il set 2." },
    });
  });
});
