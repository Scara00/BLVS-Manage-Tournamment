import { describe, expect, it } from "vitest";
import {
  annuncioPartita,
  eventoDellaTappa,
  inCampoAdesso,
  isMiaPartita,
  ordinaMiePartite,
  ordinaPartite,
  punteggioVisibile,
  soloTappa,
  vistaLive,
} from "./tappa";
import type { GroupStandings, LiveEvent, LiveMatch } from "./types";

const ME = "i1";

function match(
  id: string,
  over: Omit<Partial<LiveMatch>, "players"> & {
    casa?: string[];
    ospiti?: string[];
  } = {},
): LiveMatch {
  const { casa = ["x1", "x2"], ospiti = ["x3", "x4"], ...rest } = over;
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
    state: "in_corso",
    players: {
      home: casa.map((p) => ({ id: p, name: p })),
      away: ospiti.map((p) => ({ id: p, name: p })),
    },
    ...rest,
  };
}

const girone = (id: string, players: string[]): GroupStandings => ({
  id,
  label: `Girone ${id}`,
  stageId: "t",
  category: "M",
  rows: players.map((p, i) => ({
    position: i + 1,
    pair: p,
    playerId: p,
    played: 0,
    won: 0,
    points: 0,
  })),
});

const event = (e: LiveEvent): LiveEvent => e;

describe("isMiaPartita", () => {
  it("riconosce il giocatore in entrambe le squadre", () => {
    expect(isMiaPartita(match("a", { casa: [ME, "x"] }), ME)).toBe(true);
    expect(isMiaPartita(match("b", { ospiti: ["x", ME] }), ME)).toBe(true);
    expect(isMiaPartita(match("c"), ME)).toBe(false);
  });

  it("senza giocatori o senza «me» nessuna partita è mia", () => {
    expect(isMiaPartita(match("a", { casa: [ME] }), null)).toBe(false);
    expect(isMiaPartita({ ...match("b"), players: undefined }, ME)).toBe(false);
  });
});

describe("ordinaPartite", () => {
  it("mette prima le mie, poi i campi in ordine naturale", () => {
    const ordinate = ordinaPartite(
      [
        match("c10", { court: "Campo 10" }),
        match("c2", { court: "Campo 2" }),
        match("mia", { court: "Campo 9", ospiti: [ME, "y"] }),
        match("c1", { court: "Campo 1" }),
      ],
      ME,
    );
    expect(ordinate.map((m) => m.id)).toEqual(["mia", "c1", "c2", "c10"]);
  });

  it("a parità di campo ordina per id, senza mutare l'input", () => {
    const input = [match("b"), match("a")];
    expect(ordinaPartite(input, null).map((m) => m.id)).toEqual(["a", "b"]);
    expect(input.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("ordinaMiePartite", () => {
  it("in corso, poi da giocare per turno, poi giocate", () => {
    const ordinate = ordinaMiePartite([
      match("t3", { state: "programmata", round: 3 }),
      match("t1", { state: "conclusa", round: 1 }),
      match("t2", { state: "programmata", round: 2 }),
      match("ora", { state: "in_corso", round: 2 }),
    ]);
    expect(ordinate.map((m) => m.id)).toEqual(["ora", "t2", "t3", "t1"]);
  });
});

describe("inCampoAdesso", () => {
  it("per girone: la partita in corso, altrimenti la prossima da giocare", () => {
    const ids = inCampoAdesso([
      match("a1", { groupId: "a", state: "conclusa", round: 1 }),
      match("a3", { groupId: "a", state: "programmata", round: 3 }),
      match("a2", { groupId: "a", state: "programmata", round: 2 }),
      match("b2", { groupId: "b", state: "programmata", round: 2 }),
      match("b3", { groupId: "b", state: "in_corso", round: 3 }),
      match("c1", { groupId: "c", state: "conclusa", round: 1 }),
    ]).map((m) => m.id);
    expect(ids.sort()).toEqual(["a2", "b3"]);
  });
});

describe("vistaLive", () => {
  const partite = [
    match("mia-1", { casa: [ME, "x2"], state: "conclusa", round: 1 }),
    match("mia-2", { ospiti: [ME, "x3"], state: "programmata", round: 2 }),
    match("altra-live", { groupId: "g2", court: "Campo 3" }),
    match("altra-fatta", { groupId: "g2", state: "conclusa" }),
    match("annullata", { casa: [ME, "x4"], state: "annullata" }),
  ];

  it("separa le mie partite da quelle in campo", () => {
    const vista = vistaLive(
      { matches: partite, groups: [girone("g1", [ME, "x2"])] },
      ME,
    );
    expect(vista.mie.map((m) => m.id)).toEqual(["mia-2", "mia-1"]);
    expect(vista.inCampo.map((m) => m.id)).toEqual(["altra-live"]);
    expect(vista.mioGirone?.id).toBe("g1");
  });

  it("trova il girone dalla mia partita se la classifica non mi nomina", () => {
    const vista = vistaLive(
      { matches: partite, groups: [girone("g1", ["a", "b"])] },
      ME,
    );
    expect(vista.mioGirone?.id).toBe("g1");
  });

  it("uno spettatore vede solo le partite in campo, girone per girone", () => {
    const vista = vistaLive(
      { matches: partite, groups: [girone("g1", [ME])] },
      null,
    );
    expect(vista.mie).toEqual([]);
    expect(vista.mioGirone).toBeNull();
    expect(vista.inCampo.map((m) => m.id)).toEqual(["mia-2", "altra-live"]);
  });

  it("le partite senza stato (publisher precedenti) sono in campo", () => {
    const { state: _state, ...senzaStato } = match("vecchia");
    void _state;
    expect(
      vistaLive({ matches: [senzaStato], groups: [] }, ME).inCampo,
    ).toHaveLength(1);
  });
});

describe("soloTappa / eventoDellaTappa", () => {
  it("tiene solo partite e gironi della tappa", () => {
    const sync = soloTappa(
      {
        seq: 1,
        updatedAt: "",
        matches: [match("a"), match("b", { stageId: "altra" })],
        groups: [girone("g1", []), { ...girone("g2", []), stageId: undefined }],
        overall: [],
        pendingScores: [],
      },
      "t",
    );
    expect(sync.matches.map((m) => m.id)).toEqual(["a"]);
    expect(sync.groups.map((g) => g.id)).toEqual(["g1"]);
  });

  it("legge solo risultati e classifiche della tappa", () => {
    const base = { seq: 1, savedAt: "" };
    expect(
      eventoDellaTappa({ ...base, type: "score", match: match("a") }, "t"),
    ).toBe(true);
    expect(
      eventoDellaTappa({ ...base, type: "score", match: match("a") }, "x"),
    ).toBe(false);
    expect(
      eventoDellaTappa(
        {
          ...base,
          type: "pending-scores",
          stage: { id: "t", label: "", count: 1 },
        },
        "t",
      ),
    ).toBe(false);
  });
});

describe("annuncioPartita", () => {
  const base = { seq: 1, savedAt: "" };

  it("la mia partita si legge dal mio lato", () => {
    const sets: [number, number][] = [[19, 21]];
    expect(
      annuncioPartita(
        event({
          ...base,
          type: "score",
          match: match("a", { casa: [ME], sets }),
        }),
        ME,
      ),
    ).toBe("La tua partita: 19-21");
    expect(
      annuncioPartita(
        event({
          ...base,
          type: "score",
          match: match("a", { ospiti: [ME], sets }),
        }),
        ME,
      ),
    ).toBe("La tua partita: 21-19");
  });

  it("le altre partite e i gironi restano brevi", () => {
    expect(
      annuncioPartita(
        event({
          ...base,
          type: "score",
          match: match("a", { sets: [[21, 15]] }),
        }),
        ME,
      ),
    ).toBe("Girone A: nuovo risultato 21-15");
    expect(
      annuncioPartita(
        event({ ...base, type: "group-standings", group: girone("g1", [ME]) }),
        ME,
      ),
    ).toBe("Classifica del tuo girone aggiornata");
  });
});

describe("punteggioVisibile", () => {
  it("separa i set con un punto mediano", () => {
    expect(
      punteggioVisibile(
        match("a", {
          sets: [
            [21, 19],
            [15, 13],
          ],
        }),
      ),
    ).toBe("21–19 · 15–13");
  });
});
