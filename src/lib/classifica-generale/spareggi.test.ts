import { describe, expect, it } from "vitest";
import type { TotaleGiocatore } from "./somma";
import {
  CRITERI_GENERALE,
  ordinaClassifica,
  REGOLA_GENERALE,
  spiegaRegolaGenerale,
} from "./spareggi";

/** `tappe`: [data, posizione | null, punti] per stage. */
function totale(
  id: string,
  tappe: [string, number | null, number][],
): TotaleGiocatore {
  return {
    utenteId: id,
    nome: id,
    punti: tappe.reduce((s, [, , punti]) => s + punti, 0),
    tappeGiocate: tappe.length,
    puntiProvvisori: false,
    tappe: tappe.map(([data, posizione, punti]) => ({
      tappaId: data,
      nome: data,
      data,
      posizione,
      punti,
      provvisori: false,
    })),
  };
}

const posizioni = (righe: ReturnType<typeof ordinaClassifica>) =>
  righe.map((r) => [r.utenteId, r.posizione]);

describe("ordinaClassifica", () => {
  it("ordina per punti", () => {
    const righe = ordinaClassifica([
      totale("b", [["2026-05-01", 3, 4]]),
      totale("a", [["2026-05-01", 1, 12]]),
    ]);
    expect(posizioni(righe)).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("a pari punti vince chi ha più primi posti, poi più secondi posti", () => {
    // a: 8 + 8 (two 2nd places), b: 12 + 4 (a 1st place): b is above.
    const righe = ordinaClassifica([
      totale("a", [
        ["2026-05-01", 2, 8],
        ["2026-06-01", 2, 8],
      ]),
      totale("b", [
        ["2026-05-01", 1, 12],
        ["2026-06-01", 3, 4],
      ]),
    ]);
    expect(posizioni(righe)).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("poi conta il piazzamento nella tappa più recente", () => {
    // Same places overall (1st and 3rd), but b was 1st in the latest stage.
    const righe = ordinaClassifica([
      totale("a", [
        ["2026-05-01", 1, 12],
        ["2026-06-01", 3, 4],
      ]),
      totale("b", [
        ["2026-05-01", 3, 4],
        ["2026-06-01", 1, 12],
      ]),
    ]);
    expect(posizioni(righe)).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("poi sta più in alto chi ha giocato meno tappe", () => {
    const righe = ordinaClassifica([
      totale("a", [
        ["2026-05-01", 1, 12],
        ["2026-06-01", null, 0],
      ]),
      totale("b", [["2026-05-01", 1, 12]]),
    ]);
    // Same points and places; the latest stage: a has no place, b did not
    // play it, so it is level too; fewer stages decides.
    expect(posizioni(righe)).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("pari merito: se la parità resta, stessa posizione e la successiva salta", () => {
    const righe = ordinaClassifica([
      totale("c", [["2026-05-01", 5, 8]]),
      totale("b", [["2026-05-01", null, 0]]),
      totale("a", [["2026-05-01", null, 0]]),
      totale("d", [["2026-05-01", null, 0]]),
    ]);
    expect(posizioni(righe)).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 2],
      ["d", 2],
    ]);
    expect(righe.map((r) => r.pariMerito)).toEqual([false, true, true, true]);
  });

  it("la posizione dopo un pari merito salta i posti condivisi (1, 1, 3)", () => {
    const righe = ordinaClassifica([
      totale("a", [["2026-05-01", 1, 12]]),
      totale("b", [["2026-05-01", 1, 12]]),
      totale("c", [["2026-05-01", 3, 4]]),
    ]);
    expect(righe.map((r) => r.posizione)).toEqual([1, 1, 3]);
  });

  it("lo spareggio è configurabile (Q-06): con i soli punti la parità resta", () => {
    const totali = [
      totale("a", [
        ["2026-05-01", 2, 8],
        ["2026-06-01", 2, 8],
      ]),
      totale("b", [
        ["2026-05-01", 1, 12],
        ["2026-06-01", 3, 4],
      ]),
    ];
    const righe = ordinaClassifica(totali, { criteri: ["punti"] });
    expect(righe.map((r) => r.posizione)).toEqual([1, 1]);
  });

  it("la regola usa ogni criterio una volta e ha un testo per ognuno", () => {
    expect(new Set(REGOLA_GENERALE.criteri).size).toBe(
      REGOLA_GENERALE.criteri.length,
    );
    expect(REGOLA_GENERALE.criteri).toEqual([...CRITERI_GENERALE]);
    expect(spiegaRegolaGenerale()).toHaveLength(CRITERI_GENERALE.length + 1);
  });
});
