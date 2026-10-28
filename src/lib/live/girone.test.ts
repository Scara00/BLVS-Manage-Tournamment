import { describe, expect, it } from "vitest";
import {
  annuncioGirone,
  COLONNE_CLASSIFICA,
  diffLabel,
  etichettaFascia,
  eventoDelGirone,
  lineaDiTaglio,
  valoreColonna,
  vistaGirone,
} from "./girone";
import type { LiveEvent, LiveMatch } from "./types";

const ME = "i1";

function match(id: string, over: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id,
    court: "Campo 1",
    groupId: "g1",
    groupLabel: "Girone A",
    home: "Uno/Due",
    away: "Tre/Quattro",
    sets: [],
    stageId: "t",
    category: "M",
    state: "programmata",
    players: {
      home: [
        { id: ME, name: "Rossi Luca" },
        { id: "i2", name: "Bianchi Marco" },
      ],
      away: [
        { id: "i3", name: "Verdi Paolo" },
        { id: "i4", name: "Neri Ugo" },
      ],
    },
    ...over,
  };
}

const posizioni = (...p: number[]) => p.map((position) => ({ position }));

const score = (m: LiveMatch): LiveEvent => ({
  seq: 1,
  savedAt: "2027-06-12T08:31:00.000Z",
  type: "score",
  match: m,
});

describe("vistaGirone", () => {
  it("mette in evidenza la partita in corso e le altre per turno", () => {
    const vista = vistaGirone(
      {
        matches: [
          match("t3", { round: 3 }),
          match("t2", { round: 2, state: "in_corso" }),
          match("t1", { round: 1, state: "conclusa", sets: [[21, 19]] }),
          match("altro", { groupId: "g2", state: "in_corso" }),
        ],
        groups: [{ id: "g1", label: "Girone A", rows: [] }],
      },
      "g1",
    );
    expect(vista.inCorso?.id).toBe("t2");
    expect(vista.altre.map((m) => m.id)).toEqual(["t1", "t3"]);
    expect(vista.standing?.label).toBe("Girone A");
  });

  it("nessuna partita in corso: null", () => {
    const vista = vistaGirone({ matches: [match("t1")], groups: [] }, "g1");
    expect(vista.inCorso).toBeNull();
    expect(vista.standing).toBeNull();
  });
});

describe("lineaDiTaglio", () => {
  const iniziale = { fase: "iniziale" as const, gironiDellaFase: 4 };

  it("girone iniziale: ★ Gold sopra il 2°, ◆ Silver sotto", () => {
    const linea = lineaDiTaglio(iniziale, posizioni(1, 2, 3, 4));
    expect(linea).toMatchObject({ dopo: 2, aCavallo: false });
    expect(etichettaFascia(linea!.sopra)).toBe("★ Gold");
    expect(etichettaFascia(linea!.sotto!)).toBe("◆ Silver");
  });

  it("segnala una parità a cavallo della linea", () => {
    expect(lineaDiTaglio(iniziale, posizioni(1, 2, 2, 4))?.aCavallo).toBe(true);
    expect(lineaDiTaglio(iniziale, posizioni(1, 1, 3, 4))?.aCavallo).toBe(
      false,
    );
  });

  it("nessuna linea se non c'è nessuno sotto", () => {
    expect(lineaDiTaglio(iniziale, posizioni(1, 2))).toBeNull();
    expect(lineaDiTaglio(iniziale, [])).toBeNull();
  });

  it("girone gold: i primi 4/n vanno alla finale gold", () => {
    const due = lineaDiTaglio(
      { fase: "gold", gironiDellaFase: 2 },
      posizioni(1, 2, 3, 4),
    );
    expect(due?.dopo).toBe(2);
    expect(etichettaFascia(due!.sopra)).toBe("★ Finale gold");
    expect(due?.sotto).toBeNull();
    const quattro = lineaDiTaglio(
      { fase: "silver", gironiDellaFase: 4 },
      posizioni(1, 2, 3, 4),
    );
    expect(quattro?.dopo).toBe(1);
    expect(etichettaFascia(quattro!.sopra)).toBe("◆ Finale silver");
  });

  it("n che non divide 4, una finale: nessuna linea", () => {
    expect(
      lineaDiTaglio({ fase: "gold", gironiDellaFase: 3 }, posizioni(1, 2, 3)),
    ).toBeNull();
    expect(
      lineaDiTaglio(
        { fase: "finale_gold", gironiDellaFase: 1 },
        posizioni(1, 2, 3, 4),
      ),
    ).toBeNull();
  });
});

describe("colonne", () => {
  it("PG, V, PF, PS, Diff nell'ordine, con il nome intero", () => {
    expect(COLONNE_CLASSIFICA.map((c) => c.abbr)).toEqual([
      "PG",
      "V",
      "PF",
      "PS",
      "Diff",
    ]);
    expect(COLONNE_CLASSIFICA.map((c) => c.nome)).toEqual([
      "Partite giocate",
      "Vittorie",
      "Punti fatti",
      "Punti subiti",
      "Differenza punti",
    ]);
  });

  it("differenza con il segno, «–» se manca", () => {
    expect(diffLabel(5)).toBe("+5");
    expect(diffLabel(-3)).toBe("−3");
    expect(diffLabel(0)).toBe("0");
    expect(diffLabel(undefined)).toBe("–");
    const row = { position: 1, pair: "A", played: 1, won: 1, points: 21 };
    expect(valoreColonna(row, "against")).toBe("–");
    expect(valoreColonna({ ...row, against: 19, diff: 2 }, "diff")).toBe("+2");
  });
});

describe("annuncioGirone", () => {
  it("la mia partita dal mio lato, come w-live", () => {
    const m = match("t1", { state: "conclusa", sets: [[19, 21]] });
    expect(annuncioGirone(score(m), ME)).toBe("La tua partita: 19-21");
  });

  it("le altre partite con nomi e punteggio", () => {
    const m = match("t1", { state: "conclusa", sets: [[21, 17]] });
    expect(annuncioGirone(score(m), "spettatore")).toBe(
      "Rossi Luca e Bianchi Marco contro Verdi Paolo e Neri Ugo: 21-17",
    );
    const parziale = match("t1", {
      state: "in_corso",
      partial: { home: 8, away: 5, updatedAt: "2027-06-12T08:31:00.000Z" },
    });
    expect(annuncioGirone(score(parziale), null)).toBe(
      "Rossi Luca e Bianchi Marco contro Verdi Paolo e Neri Ugo, parziale 8-5",
    );
  });
});

describe("eventoDelGirone", () => {
  it("solo il girone e la tappa giusti", () => {
    expect(eventoDelGirone(score(match("t1")), "t", "g1")).toBe(true);
    expect(
      eventoDelGirone(score(match("t1", { groupId: "g2" })), "t", "g1"),
    ).toBe(false);
    expect(
      eventoDelGirone(score(match("t1", { stageId: "x" })), "t", "g1"),
    ).toBe(false);
    const standings = (id: string): LiveEvent => ({
      seq: 2,
      savedAt: "2027-06-12T08:31:00.000Z",
      type: "group-standings",
      group: { id, label: "Girone", stageId: "t", rows: [] },
    });
    expect(eventoDelGirone(standings("g1"), "t", "g1")).toBe(true);
    expect(eventoDelGirone(standings("g2"), "t", "g1")).toBe(false);
  });
});
