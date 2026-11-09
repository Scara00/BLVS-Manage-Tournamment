import { describe, expect, it } from "vitest";
import { classificaGirone, categorieDa } from "@/lib/gironi/classifica";
import { giocatoriMisti, partiteMiste } from "./fixtures";

describe("fixture del girone misto", () => {
  it("dà classifiche per categoria senza parità, come dice il commento", () => {
    const giocatori = giocatoriMisti("g");
    const classifica = classificaGirone(
      giocatori.map((g) => g.iscrizioneId),
      partiteMiste("g"),
      { categorie: categorieDa(giocatori) },
    );
    expect(classifica.stato).toBe("completo");
    expect(classifica.righe.map((r) => r.iscrizioneId.slice(2)).join("")).toBe(
      "ABCDGFHE",
    );
    expect(classifica.righe.map((r) => r.posizione)).toEqual([
      1, 2, 3, 4, 1, 2, 3, 4,
    ]);
  });
});
