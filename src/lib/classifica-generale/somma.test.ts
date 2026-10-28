import { describe, expect, it } from "vitest";
import { sommaClassifica } from "./somma";
import type { PartecipazioneTappa } from "./types";

const p = (
  utenteId: string,
  tappaId: string,
  data: string,
  punti: number,
  posizione: number | null,
  provvisori = false,
): PartecipazioneTappa => ({
  utenteId,
  nome: `Giocatore ${utenteId}`,
  anonimo: false,
  risultato: {
    tappaId,
    nome: tappaId,
    data,
    posizione,
    fase: posizione === null ? null : "gold",
    posizioneDefinitiva: true,
    punti,
    provvisori,
  },
});

describe("sommaClassifica", () => {
  it("somma i punti di tutte le tappe per giocatore e conta le tappe giocate", () => {
    const [a, b] = sommaClassifica([
      p("a", "t1", "2026-05-01", 12, 1),
      p("a", "t2", "2026-06-01", 4, 3),
      p("b", "t1", "2026-05-01", 8, 2),
    ]);
    expect(a).toMatchObject({ utenteId: "a", punti: 16, tappeGiocate: 2 });
    expect(b).toMatchObject({ utenteId: "b", punti: 8, tappeGiocate: 1 });
  });

  it("conta la tappa giocata anche a zero punti (eliminato prima delle finali)", () => {
    const [a] = sommaClassifica([
      p("a", "t1", "2026-05-01", 0, null),
      p("a", "t2", "2026-06-01", 2, 4),
    ]);
    expect(a).toMatchObject({ punti: 2, tappeGiocate: 2 });
  });

  it("i punti sono provvisori finché una delle tappe ha il tabellone aperto", () => {
    const [a, b] = sommaClassifica([
      p("a", "t1", "2026-05-01", 12, 1),
      p("a", "t2", "2026-06-01", 8, 2, true),
      p("b", "t1", "2026-05-01", 8, 2),
    ]);
    expect(a.puntiProvvisori).toBe(true);
    expect(b.puntiProvvisori).toBe(false);
  });

  it("una tappa conta una volta sola e le tappe vanno dalla più recente", () => {
    const [a] = sommaClassifica([
      p("a", "t1", "2026-05-01", 12, 1),
      p("a", "t2", "2026-06-01", 8, 2),
      p("a", "t1", "2026-05-01", 12, 1),
    ]);
    expect(a.punti).toBe(20);
    expect(a.tappe.map((t) => t.tappaId)).toEqual(["t2", "t1"]);
  });

  it("senza tappe la classifica è vuota", () => {
    expect(sommaClassifica([])).toEqual([]);
  });
});
