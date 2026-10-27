import { describe, expect, it } from "vitest";
import { righeStorie, OGGI } from "@/components/admin-registro/stories-data";
import { toVoceView } from "./format";
import { etichettaGiorno, raggruppaPerGiorno } from "./raggruppa";

describe("etichettaGiorno", () => {
  it("dice Oggi e Ieri, poi solo il giorno", () => {
    expect(etichettaGiorno("2027-06-12", OGGI)).toBe("Oggi · sabato 12 giugno");
    expect(etichettaGiorno("2027-06-11", OGGI)).toBe(
      "Ieri · venerdì 11 giugno",
    );
    expect(etichettaGiorno("2027-06-09", OGGI)).toBe("mercoledì 9 giugno");
  });

  it("aggiunge l'anno quando non è quello corrente, e Ieri attraversa l'anno", () => {
    expect(etichettaGiorno("2026-12-31", "2027-01-01")).toBe(
      "Ieri · giovedì 31 dicembre 2026",
    );
  });
});

describe("raggruppaPerGiorno", () => {
  it("raggruppa per giorno di Roma, mantenendo l'ordine", () => {
    const giorni = raggruppaPerGiorno(righeStorie().map(toVoceView), OGGI);
    expect(giorni.map((g) => [g.etichetta, g.voci.length])).toEqual([
      ["Oggi · sabato 12 giugno", 4],
      ["Ieri · venerdì 11 giugno", 3],
      ["mercoledì 9 giugno", 1],
    ]);
    const ids = giorni.flatMap((g) => g.voci.map((v) => v.id));
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it("la mezzanotte è quella di Roma, non UTC", () => {
    const [riga] = righeStorie(1);
    // 22:30 UTC of the 11th is 00:30 of the 12th in Rome (UTC+2).
    const tardi = toVoceView({ ...riga, created_at: "2027-06-11T22:30:00Z" });
    const prima = toVoceView({
      ...riga,
      id: 1,
      created_at: "2027-06-11T21:30:00Z",
    });
    const giorni = raggruppaPerGiorno([tardi, prima], OGGI);
    expect(giorni.map((g) => g.giorno)).toEqual(["2027-06-12", "2027-06-11"]);
    expect(tardi.dataOra).toContain("00:30");
  });

  it("nessuna voce, nessun giorno", () => {
    expect(raggruppaPerGiorno([], OGGI)).toEqual([]);
  });
});
