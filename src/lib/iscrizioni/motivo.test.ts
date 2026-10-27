import { describe, expect, it } from "vitest";
import { motivoBlocco, testoMotivo, type Iscrivibilita } from "./motivo";

const APERTA: Iscrivibilita = {
  stato: "iscrizioni_aperte",
  aprono: "2027-05-15T07:00:00Z",
  chiudono: "2027-06-19T21:59:00Z",
  categoria: "M",
  liberi: 5,
  iscritto: false,
};

const PRIMA = new Date("2027-06-01T10:00:00Z");

describe("motivoBlocco", () => {
  it("nessun motivo: iscrizioni aperte, in tempo, con posti", () => {
    expect(motivoBlocco(APERTA, PRIMA)).toBeNull();
  });

  it.each([
    ["annullata", { stato: "annullata" as const }],
    ["gia_iscritto", { iscritto: true }],
    ["chiuse", { stato: "iscrizioni_chiuse" as const }],
    ["chiuse", { stato: "in_corso" as const }],
    ["chiuse", { aprono: "2027-06-02T00:00:00Z" }],
    ["scadute", { chiudono: "2027-06-01T09:59:59Z" }],
    ["categoria_mancante", { categoria: null }],
    ["esaurite", { liberi: 0 }],
  ])("%s", (motivo, patch) => {
    expect(motivoBlocco({ ...APERTA, ...patch }, PRIMA)).toBe(motivo);
  });

  it("l'ordine conta: annullata vince su già iscritto, già iscritto su esaurite", () => {
    expect(
      motivoBlocco({ ...APERTA, stato: "annullata", iscritto: true }, PRIMA),
    ).toBe("annullata");
    expect(motivoBlocco({ ...APERTA, iscritto: true, liberi: 0 }, PRIMA)).toBe(
      "gia_iscritto",
    );
    expect(
      motivoBlocco(
        { ...APERTA, chiudono: "2027-05-01T00:00:00Z", liberi: 0 },
        PRIMA,
      ),
    ).toBe("scadute");
  });

  it("la scadenza è un istante: un secondo prima aperta, allo scoccare scaduta", () => {
    const scadenza = new Date(APERTA.chiudono!);
    expect(
      motivoBlocco(APERTA, new Date(scadenza.getTime() - 1000)),
    ).toBeNull();
    expect(motivoBlocco(APERTA, scadenza)).toBe("scadute");
  });

  it("vale l'ora italiana anche al cambio dell'ora legale", () => {
    // Scadenza alle 02:00 del 25 ottobre 2026, ora solare (01:00 UTC): alle
    // 02:30 ora legale (00:30 UTC) è ancora aperta, alle 02:30 solare no.
    const input = { ...APERTA, aprono: null, chiudono: "2026-10-25T01:00:00Z" };
    expect(motivoBlocco(input, new Date("2026-10-25T00:30:00Z"))).toBeNull();
    expect(motivoBlocco(input, new Date("2026-10-25T01:30:00Z"))).toBe(
      "scadute",
    );
    expect(testoMotivo("scadute", input)).toBe(
      "Le iscrizioni sono scadute il 25 ottobre alle ore 02:00.",
    );
  });
});

describe("testoMotivo", () => {
  it("dice la scadenza in ora italiana", () => {
    expect(testoMotivo("scadute", APERTA)).toMatch(/19 giugno/);
    expect(testoMotivo("scadute", APERTA)).toMatch(/23:59/);
  });

  it("ha un testo per ogni motivo", () => {
    for (const motivo of [
      "annullata",
      "gia_iscritto",
      "chiuse",
      "scadute",
      "categoria_mancante",
      "esaurite",
    ] as const) {
      expect(testoMotivo(motivo)).not.toBe("");
    }
  });
});
