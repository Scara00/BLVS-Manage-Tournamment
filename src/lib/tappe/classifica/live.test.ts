import { describe, expect, it } from "vitest";
import {
  conclusa,
  definitiva,
  inAttesa,
  inCorso,
  parita,
} from "@/components/classifica-tappa/fixtures";
import { applyLiveEvent, type LiveSnapshot } from "@/lib/live/types";
import {
  annuncioClassificaTappa,
  cambioClassificaTappa,
  classificaMostrata,
  eventoDellaClassificaTappa,
  idClassificaTappa,
  parseCategoriaTappa,
  parseIdClassificaTappa,
  puntiPerPosizioneTesto,
  puntiRigaLabel,
} from "./live";

const sintesi = (s: typeof definitiva) =>
  s.rows.map((r) => [r.name, r.phase, r.position, r.points]);

describe("toStageStandings: punti per posizione", () => {
  it("gold 12, 8, 4, 2 poi silver 8, 6, 2, 1, posizione continua", () => {
    expect(sintesi(definitiva)).toEqual([
      ["Luca Rossi", "gold", 1, 12],
      ["Paolo Marino", "gold", 2, 8],
      ["Marco Bianchi", "gold", 3, 4],
      ["Davide Greco", "gold", 4, 2],
      ["Andrea Conti", "silver", 5, 8],
      ["Niccolò Esposito", "silver", 6, 6],
      ["Simone Ricci", "silver", 7, 2],
      ["Matteo Romano", "silver", 8, 1],
    ]);
    expect(definitiva.id).toBe("jesolo:M");
    expect(definitiva.label).toBe("Tappa 1 · Jesolo, maschile");
  });

  it("provvisori finché il tabellone non è chiuso", () => {
    expect(definitiva).toMatchObject({
      state: "definitiva",
      provisional: true,
    });
    expect(conclusa).toMatchObject({ state: "conclusa", provisional: false });
    expect(inAttesa).toMatchObject({ state: "in_attesa", rows: [] });
  });

  it("con l'ultima partita in campo le posizioni silver non sono definitive", () => {
    expect(inCorso.state).toBe("in_corso");
    expect(
      inCorso.rows.filter((r) => r.phase === "silver").map((r) => r.definitive),
    ).toEqual([false, false, false, false]);
    expect(
      inCorso.rows.filter((r) => r.phase === "gold").every((r) => r.definitive),
    ).toBe(true);
  });

  it("parità perfetta: stessa posizione e stessi punti, da risolvere", () => {
    const pari = parita.rows.filter((r) => r.toResolve);
    expect(pari.map((r) => [r.position, r.points])).toEqual([
      [2, 8],
      [2, 8],
      [2, 8],
    ]);
  });
});

describe("cambioClassificaTappa", () => {
  it("senza una classifica precedente: null (annuncio generico)", () => {
    expect(cambioClassificaTappa(undefined, definitiva)).toBeNull();
  });

  it("nulla di nuovo: undefined, non si pubblica", () => {
    expect(
      cambioClassificaTappa(definitiva, { ...definitiva, change: "x" }),
    ).toBeUndefined();
  });

  it("chiusura: «punti definitivi»", () => {
    expect(cambioClassificaTappa(definitiva, conclusa)).toBe(
      "punti definitivi",
    );
  });

  it("posizioni diventate definitive", () => {
    expect(cambioClassificaTappa(inCorso, definitiva)).toBe(
      "4 posizioni definitive",
    );
    const una = {
      ...inCorso,
      rows: inCorso.rows.map((r) =>
        r.name === "Andrea Conti" ? { ...r, definitive: true } : r,
      ),
    };
    expect(cambioClassificaTappa(inCorso, una)).toBe(
      "posizione definitiva per Andrea Conti",
    );
  });
});

describe("annuncioClassificaTappa", () => {
  it("una frase: cosa è cambiato e la posizione del giocatore", () => {
    expect(
      annuncioClassificaTappa({ ...conclusa, change: "punti definitivi" }, "a"),
    ).toBe(
      "Classifica di tappa maschile aggiornata: punti definitivi: la tua posizione: 1ª, 12 punti",
    );
    expect(annuncioClassificaTappa(definitiva, "a")).toBe(
      "Classifica di tappa maschile aggiornata: la tua posizione: 1ª, 12 punti provvisori",
    );
    expect(annuncioClassificaTappa(parita, "b")).toContain(
      "2ª a pari merito, 8 punti provvisori",
    );
    expect(annuncioClassificaTappa(definitiva, null)).toBe(
      "Classifica di tappa maschile aggiornata",
    );
  });
});

describe("helper", () => {
  it("id e parsing", () => {
    expect(idClassificaTappa("e2e-x", "F")).toBe("e2e-x:F");
    expect(parseIdClassificaTappa("e2e-x:F")).toEqual({
      tappaId: "e2e-x",
      categoria: "F",
    });
    expect(parseIdClassificaTappa("e2e-x:Z")).toBeNull();
    expect(parseIdClassificaTappa(":M")).toBeNull();
    expect(parseCategoriaTappa("f")).toBe("F");
    expect(parseCategoriaTappa("x")).toBeNull();
  });

  it("etichette dei punti", () => {
    expect(puntiRigaLabel(1, true)).toBe("1 punto provvisorio");
    expect(puntiRigaLabel(8, true)).toBe("8 punti provvisori");
    expect(puntiRigaLabel(12, false)).toBe("12 punti");
    expect(puntiPerPosizioneTesto("gold")).toBe("12, 8, 4, 2");
    expect(puntiPerPosizioneTesto("silver")).toBe("8, 6, 2, 1");
  });

  it("un board-closed dello stesso tabellone toglie «provvisori»", () => {
    expect(classificaMostrata(definitiva, true)).toMatchObject({
      provisional: false,
      state: "conclusa",
    });
    expect(classificaMostrata(definitiva, false)).toBe(definitiva);
  });

  it("accetta solo la classifica e la chiusura del proprio tabellone", () => {
    const base = { seq: 1, savedAt: "2026-07-18T08:00:00.000Z" };
    expect(
      eventoDellaClassificaTappa(
        { ...base, type: "stage-standings", standings: definitiva },
        "jesolo:M",
      ),
    ).toBe(true);
    expect(
      eventoDellaClassificaTappa(
        { ...base, type: "stage-standings", standings: definitiva },
        "jesolo:F",
      ),
    ).toBe(false);
    expect(
      eventoDellaClassificaTappa(
        {
          ...base,
          type: "board-closed",
          board: {
            id: "jesolo:M",
            stageId: "jesolo",
            category: "M",
            label: "x",
            closedAt: base.savedAt,
            stageConcluded: false,
            points: [],
          },
        },
        "jesolo:M",
      ),
    ).toBe(true);
  });
});

describe("applyLiveEvent: classifica di tappa", () => {
  it("aggiunge e poi sostituisce la classifica del tabellone", () => {
    const vuoto: LiveSnapshot = {
      seq: 0,
      updatedAt: "2026-07-18T08:00:00.000Z",
      matches: [],
      groups: [],
      overall: [],
      pendingScores: [],
    };
    const primo = applyLiveEvent(vuoto, {
      type: "stage-standings",
      standings: definitiva,
      seq: 1,
      savedAt: "2026-07-18T08:01:00.000Z",
    });
    expect(primo.stageStandings).toEqual([definitiva]);
    expect(primo.updatedAt).toBe("2026-07-18T08:01:00.000Z");
    const secondo = applyLiveEvent(primo, {
      type: "stage-standings",
      standings: conclusa,
      seq: 2,
      savedAt: "2026-07-18T08:02:00.000Z",
    });
    expect(secondo.stageStandings).toEqual([conclusa]);
  });
});
