import { describe, expect, it } from "vitest";
import { faseCorrente, passiFasi, PASSO_LABEL } from "./fasi";

describe("faseCorrente", () => {
  it("«Iscrizioni» finché nessuna fase è avviata", () => {
    expect(faseCorrente(null, null)).toBe("iscrizioni");
  });

  it.each([
    ["gironi_iniziali", "gironi_iniziali"],
    ["gironi_gold_silver", "gironi_gold_silver"],
    ["finali", "finali"],
  ] as const)("la fase di gioco %s", (faseGioco, attesa) => {
    expect(faseCorrente(faseGioco, null)).toBe(attesa);
  });

  it("«Conclusa» quando il tabellone è chiuso (BLVS-43)", () => {
    expect(faseCorrente("finali", "2026-07-19T18:00:00Z")).toBe("conclusa");
    expect(PASSO_LABEL.conclusa).toBe("Conclusa");
  });
});

describe("passiFasi", () => {
  it("cinque passi a testo, uno solo corrente", () => {
    const passi = passiFasi("gironi_gold_silver");
    expect(passi.map((p) => p.label)).toEqual([
      "Iscrizioni",
      "Gironi iniziali",
      "Gironi gold e silver",
      "Finali",
      "Conclusa",
    ]);
    expect(passi.map((p) => p.stato)).toEqual([
      "fatta",
      "fatta",
      "corrente",
      "futura",
      "futura",
    ]);
  });

  it("concluso: tutti i passi fatti tranne l'ultimo, che è corrente", () => {
    expect(passiFasi("conclusa").filter((p) => p.stato === "corrente")).toEqual(
      [{ fase: "conclusa", label: "Conclusa", stato: "corrente" }],
    );
  });
});
