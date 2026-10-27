import { describe, expect, it } from "vitest";
import {
  avanzamentoFase,
  avanzamentoLabel,
  descriviPartita,
  faseCorrente,
  isDaInserire,
  partiteInCorso,
  raggruppaPartite,
  setsLabel,
  squadraLabel,
  vincitore,
} from "./format";
import type { PartitaLive } from "./types";

const ADESSO = new Date("2026-06-14T10:00:00Z");

function partita(over: Partial<PartitaLive> & { id: string }): PartitaLive {
  return {
    fase: "gironi",
    gironeId: "g1",
    gironeNome: "Girone A",
    gironePosizione: 1,
    turno: 1,
    campo: null,
    programmataIl: null,
    stato: "programmata",
    squadraA: [],
    squadraB: [],
    sets: [],
    versione: 1,
    ...over,
  };
}

describe("raggruppaPartite", () => {
  it("senza partite non ha fasi", () => {
    expect(raggruppaPartite([])).toEqual([]);
  });

  it("raggruppa per fase e girone, nell'ordine del tabellone e dei turni", () => {
    const gruppi = raggruppaPartite([
      partita({
        id: "b2",
        gironeId: "g2",
        gironeNome: "Girone B",
        gironePosizione: 2,
        turno: 2,
      }),
      partita({ id: "a3", turno: 3 }),
      partita({
        id: "b1",
        gironeId: "g2",
        gironeNome: "Girone B",
        gironePosizione: 2,
        turno: 1,
      }),
      partita({ id: "a1", turno: 1 }),
      partita({
        id: "f1",
        fase: "finale",
        gironeId: null,
        gironeNome: null,
        gironePosizione: 0,
      }),
      partita({
        id: "e1",
        fase: "eliminazione",
        gironeId: null,
        gironeNome: null,
        gironePosizione: 0,
      }),
    ]);
    expect(
      gruppi.map((f) => ({
        fase: f.fase,
        label: f.label,
        gironi: f.gironi.map((g) => [g.nome, g.partite.map((p) => p.id)]),
      })),
    ).toEqual([
      {
        fase: "gironi",
        label: "Gironi",
        gironi: [
          ["Girone A", ["a1", "a3"]],
          ["Girone B", ["b1", "b2"]],
        ],
      },
      { fase: "eliminazione", label: "Eliminazione", gironi: [[null, ["e1"]]] },
      { fase: "finale", label: "Finale", gironi: [[null, ["f1"]]] },
    ]);
  });

  it("a parità di posizione ordina i gironi per nome", () => {
    const gruppi = raggruppaPartite([
      partita({
        id: "c",
        gironeId: "g3",
        gironeNome: "Girone C",
        gironePosizione: 0,
      }),
      partita({
        id: "a",
        gironeId: "g1",
        gironeNome: "Girone A",
        gironePosizione: 0,
      }),
    ]);
    expect(gruppi[0].gironi.map((g) => g.nome)).toEqual([
      "Girone A",
      "Girone C",
    ]);
  });
});

describe("avanzamentoFase", () => {
  const partite = [
    partita({ id: "1", stato: "conclusa", sets: [{ a: 21, b: 10 }] }),
    partita({ id: "2", stato: "in_corso" }),
    partita({ id: "3" }),
    partita({ id: "4", stato: "annullata" }),
    partita({ id: "5", fase: "eliminazione", stato: "conclusa" }),
  ];

  it("conta le partite della fase, annullate escluse", () => {
    expect(avanzamentoFase(partite, "gironi", ADESSO)).toEqual({
      totale: 3,
      daGiocare: 1,
      inCorso: 1,
      concluse: 1,
      daInserire: 1,
      percentuale: 33,
    });
  });

  it("tutte da giocare: zero per cento", () => {
    const a = avanzamentoFase(
      [partita({ id: "1" }), partita({ id: "2" })],
      "gironi",
      ADESSO,
    );
    expect(a.percentuale).toBe(0);
    expect(avanzamentoLabel(a)).toBe("0 di 2 partite concluse");
  });

  it("tutte concluse: cento per cento", () => {
    const a = avanzamentoFase(
      [
        partita({ id: "1", stato: "conclusa" }),
        partita({ id: "2", stato: "conclusa" }),
      ],
      "gironi",
      ADESSO,
    );
    expect(a.percentuale).toBe(100);
    expect(avanzamentoLabel(a)).toBe("2 di 2 partite concluse");
  });

  it("senza partite non divide per zero", () => {
    const a = avanzamentoFase([], null, ADESSO);
    expect(a).toMatchObject({ totale: 0, percentuale: 0 });
    expect(avanzamentoLabel({ ...a, totale: 1 })).toBe(
      "0 di 1 partita conclusa",
    );
  });

  it("la fase corrente è la più avanzata con partite", () => {
    expect(faseCorrente(partite)).toBe("eliminazione");
    expect(faseCorrente([partita({ id: "1" })])).toBe("gironi");
    expect(faseCorrente([])).toBeNull();
  });
});

describe("isDaInserire (stessa regola di admin_riepilogo_tappe)", () => {
  it("una partita in corso è sempre da inserire", () => {
    expect(isDaInserire(partita({ id: "1", stato: "in_corso" }), ADESSO)).toBe(
      true,
    );
  });

  it("da giocare solo se l'orario è passato e non ha set", () => {
    const passata = "2026-06-14T09:00:00Z";
    expect(
      isDaInserire(partita({ id: "1", programmataIl: passata }), ADESSO),
    ).toBe(true);
    expect(
      isDaInserire(
        partita({ id: "1", programmataIl: passata, sets: [{ a: 1, b: 0 }] }),
        ADESSO,
      ),
    ).toBe(false);
    expect(
      isDaInserire(
        partita({ id: "1", programmataIl: "2026-06-14T11:00:00Z" }),
        ADESSO,
      ),
    ).toBe(false);
    expect(isDaInserire(partita({ id: "1" }), ADESSO)).toBe(false);
  });

  it("concluse e annullate non sono da inserire", () => {
    expect(isDaInserire(partita({ id: "1", stato: "conclusa" }), ADESSO)).toBe(
      false,
    );
    expect(isDaInserire(partita({ id: "1", stato: "annullata" }), ADESSO)).toBe(
      false,
    );
  });
});

describe("etichette", () => {
  it("partite in corso in ordine di girone e turno", () => {
    expect(
      partiteInCorso([
        partita({ id: "b", stato: "in_corso", gironePosizione: 2 }),
        partita({ id: "x" }),
        partita({ id: "a", stato: "in_corso", turno: 2 }),
      ]).map((p) => p.id),
    ).toEqual(["a", "b"]);
  });

  it("descrive partite, squadre e punteggio", () => {
    expect(descriviPartita(partita({ id: "1", turno: 2 }))).toBe(
      "Girone A · turno 2",
    );
    expect(
      descriviPartita(partita({ id: "1", fase: "finale", gironeNome: null })),
    ).toBe("Finale · turno 1");
    const g = (cognome: string) => ({
      iscrizioneId: cognome,
      nome: "N",
      cognome,
    });
    expect(squadraLabel([g("Rossi"), g("Bianchi")])).toBe("Rossi e Bianchi");
    expect(squadraLabel([g("Rossi")])).toBe("Rossi");
    expect(
      setsLabel([
        { a: 21, b: 18 },
        { a: 19, b: 21 },
      ]),
    ).toBe("21-18 · 19-21");
    expect(setsLabel([])).toBeNull();
  });

  it("vince chi prende più set", () => {
    expect(
      vincitore([
        { a: 21, b: 18 },
        { a: 21, b: 15 },
      ]),
    ).toBe("A");
    expect(
      vincitore([
        { a: 21, b: 18 },
        { a: 15, b: 21 },
        { a: 10, b: 15 },
      ]),
    ).toBe("B");
    expect(
      vincitore([
        { a: 21, b: 18 },
        { a: 15, b: 21 },
      ]),
    ).toBeNull();
    expect(vincitore([])).toBeNull();
  });
});
