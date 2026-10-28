import { describe, expect, it } from "vitest";
import {
  concludiTabelloniDemo,
  creaScenarioClassificaDemo,
  DEMO_ME_CLASSIFICA,
  demoUtente,
  getDemoDatiClassifica,
  salvaFinaleDemo,
} from "@/lib/demo/classifica-generale";
import {
  classificaDaDati,
  DATI_VUOTI,
  idClassifica,
  partecipazioni,
  toOverallStandings,
} from "./dati";

describe("classifica generale dai dati della RPC", () => {
  it("somma i punti delle finali di ogni tappa (gold 12/8/4/2, silver 8/6/2/1)", () => {
    // 2026 M: Jesolo [1,2,3,4 | 5,6,7,8], Rimini [3,1,2,5 | 4,6,8,7],
    // Cagliari [1,3,2,4 | …] with the gold's last match still to play.
    const classifica = classificaDaDati(
      getDemoDatiClassifica("M", 2026),
      "M",
      2026,
    );
    const riga = (k: number) =>
      classifica.righe.find((r) => r.utenteId === demoUtente("M", k))!;
    expect(riga(5)).toMatchObject({ punti: 8 + 2 + 8, tappeGiocate: 3 });
    expect(riga(1).tappeGiocate).toBe(3);
    expect(classifica.righe[0].posizione).toBe(1);
    // The open stage makes every row provisional.
    expect(classifica.righe.every((r) => r.puntiProvvisori)).toBe(true);
  });

  it("chi è uscito prima delle finali ha la tappa giocata e zero punti", () => {
    const tutte = partecipazioni(getDemoDatiClassifica("M", 2026));
    const fuori = tutte.filter((p) => p.utenteId === demoUtente("M", 12));
    expect(fuori).toHaveLength(3);
    expect(fuori.every((p) => p.risultato.punti === 0)).toBe(true);
    expect(fuori.every((p) => p.risultato.posizione === null)).toBe(true);
  });

  it("i giocatori con la stessa storia restano pari merito", () => {
    const { righe } = classificaDaDati(
      getDemoDatiClassifica("M", 2026),
      "M",
      2026,
    );
    const ultimi = righe.filter((r) => r.punti === 0);
    expect(ultimi.length).toBeGreaterThan(1);
    expect(new Set(ultimi.map((r) => r.posizione)).size).toBe(1);
    expect(ultimi.every((r) => r.pariMerito)).toBe(true);
  });

  it("filtra per stagione", () => {
    const d2025 = getDemoDatiClassifica("M", 2025);
    expect(d2025.tappe.map((t) => t.stagione)).toEqual([2025]);
    const { righe } = classificaDaDati(d2025, "M", 2025);
    expect(righe.every((r) => r.tappeGiocate === 1)).toBe(true);
    expect(righe.some((r) => r.puntiProvvisori)).toBe(false);
  });

  it("senza tappe la classifica è vuota", () => {
    expect(classificaDaDati(DATI_VUOTI, "F", 2026).righe).toEqual([]);
  });

  it("forma live: id per categoria e stagione, righe con giocatore e punti", () => {
    const standings = toOverallStandings(
      classificaDaDati(getDemoDatiClassifica("F", 2026), "F", 2026),
      "cambio",
    );
    expect(standings.id).toBe("F:2026");
    expect(idClassifica("M", null)).toBe("M:tutte");
    expect(standings.change).toBe("cambio");
    expect(standings.rows[0]).toMatchObject({
      position: 1,
      provisional: true,
    });
  });

  it("scenario e2e: il salvataggio rende definitive le posizioni, la chiusura toglie i provvisori", () => {
    const { stagione, tappaAperta } = creaScenarioClassificaDemo();
    const leggi = () =>
      classificaDaDati(getDemoDatiClassifica("M", stagione), "M", stagione);
    const io = () =>
      leggi().righe.find((r) => r.utenteId === DEMO_ME_CLASSIFICA)!;

    // Before: the demo player leads the open gold final (12) and was 3rd
    // in the closed stage (4). The last match is an upset: 3rd, 4 points.
    expect(io()).toMatchObject({ punti: 16, puntiProvvisori: true });
    expect(salvaFinaleDemo(tappaAperta, "M")).toBe(true);
    expect(io()).toMatchObject({ punti: 8, puntiProvvisori: true });

    expect(concludiTabelloniDemo(tappaAperta)).toBe(true);
    expect(leggi().righe.some((r) => r.puntiProvvisori)).toBe(false);
    expect(salvaFinaleDemo("sconosciuta", "M")).toBe(false);
  });
});
