import { describe, expect, it } from "vitest";
import type { Categoria } from "@/lib/db/types";
import { righePerCategoria, titoloMisto } from "@/lib/tappe/formato";
import { titoloParita } from "@/lib/gironi/parita/format";
import { lineaDiTaglio } from "./girone";

const righe = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ position: i + 1 }));

describe("linea di taglio nel misto, per categoria", () => {
  it("girone iniziale: gold dopo il 2° uomo e la 2ª donna", () => {
    const linea = lineaDiTaglio(
      { fase: "iniziale", gironiDellaFase: 4, categoria: "X" },
      righe(4),
    );
    expect(linea).toMatchObject({ dopo: 2, aCavallo: false });
  });

  it("girone gold: verso la finale da 4 + 4, 4/n per categoria", () => {
    const gold = (n: number) =>
      lineaDiTaglio(
        { fase: "gold", gironiDellaFase: n, categoria: "X" },
        righe(4),
      );
    expect(gold(1)).toBeNull(); // tutti e 4 in finale: nessuna linea
    expect(gold(2)).toMatchObject({ dopo: 2 });
    expect(gold(4)).toMatchObject({ dopo: 1 });
    expect(gold(3)).toBeNull(); // finale composta dall'admin
  });
});

describe("helper del misto", () => {
  it("righePerCategoria: uomini poi donne; il classico resta uno", () => {
    const misto = righePerCategoria([
      { id: "f", category: "F" as const },
      { id: "m", category: "M" as const },
    ]);
    expect(misto.map((g) => [g.categoria, g.rows.map((r) => r.id)])).toEqual([
      ["M", ["m"]],
      ["F", ["f"]],
    ]);
    const classico: { id: string; category?: Categoria }[] = [
      { id: "a" },
      { id: "b" },
    ];
    expect(righePerCategoria(classico)).toEqual([
      { categoria: null, rows: [{ id: "a" }, { id: "b" }] },
    ]);
  });

  it("King e Queen: il 1° uomo e la 1ª donna della finale gold", () => {
    expect(titoloMisto({ category: "M", phase: "gold", position: 1 })).toBe(
      "King",
    );
    expect(titoloMisto({ category: "F", phase: "gold", position: 1 })).toBe(
      "Queen",
    );
    expect(titoloMisto({ category: "F", phase: "silver", position: 1 })).toBe(
      null,
    );
    expect(titoloMisto({ phase: "gold", position: 1 })).toBe(null);
  });

  it("il titolo di una parità dice la categoria", () => {
    expect(titoloParita(2, 2, "M")).toBe(
      "Parità per il 2º posto tra gli uomini",
    );
    expect(titoloParita(1, 3, "F")).toBe(
      "Parità dal 1º al 3º posto tra le donne",
    );
    expect(titoloParita(2, 2)).toBe("Parità per il 2º posto");
  });
});
