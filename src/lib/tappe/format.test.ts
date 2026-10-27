import { describe, expect, it } from "vitest";
import { demoStages } from "@/lib/demo/tournament";
import { demoTappaCard, formatPeriodoTappa, toTappaCard } from "./format";

describe("formatPeriodoTappa", () => {
  it("unisce i giorni dello stesso mese", () => {
    expect(formatPeriodoTappa("2026-06-14", "2026-06-15")).toBe("14–15 giugno");
  });

  it("scrive entrambi i mesi a cavallo di due mesi", () => {
    expect(formatPeriodoTappa("2026-06-30", "2026-07-01")).toBe(
      "30 giugno – 1 luglio",
    );
  });

  it("aggiunge l'anno a cavallo di due anni", () => {
    expect(formatPeriodoTappa("2026-12-31", "2027-01-01")).toBe(
      "31 dicembre 2026 – 1 gennaio 2027",
    );
  });

  it("un solo giorno", () => {
    expect(formatPeriodoTappa("2026-07-12", "2026-07-12")).toBe("12 luglio");
  });
});

describe("toTappaCard", () => {
  it("mappa una riga di public.tappe", () => {
    expect(
      toTappaCard({
        id: "t1",
        nome: "Tappa 1 · Jesolo",
        luogo: "Jesolo Lido",
        data_inizio: "2026-06-14",
        data_fine: "2026-06-15",
        stato: "iscrizioni_aperte",
      }),
    ).toEqual({
      id: "t1",
      name: "Tappa 1 · Jesolo",
      place: "Jesolo Lido",
      date: "14–15 giugno",
      stato: "iscrizioni_aperte",
    });
  });

  it("converte lo stato delle tappe demo nell'enum del database", () => {
    expect(demoStages.map(demoTappaCard).map((t) => t.stato)).toEqual([
      "in_corso",
      "iscrizioni_aperte",
      "iscrizioni_chiuse",
    ]);
  });
});
