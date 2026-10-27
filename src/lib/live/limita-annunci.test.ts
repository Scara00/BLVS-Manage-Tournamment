import { describe, expect, it } from "vitest";
import {
  chiaveParziale,
  chiaveRisultato,
  creaLimitatore,
  INTERVALLO_ANNUNCI_PARZIALE_MS,
} from "./limita-annunci";
import type { LiveEvent, LiveMatch } from "./types";

const S = 1_000;

describe("creaLimitatore", () => {
  it("di default: un annuncio ogni 30 s per partita", () => {
    expect(INTERVALLO_ANNUNCI_PARZIALE_MS).toBe(30 * S);
    const l = creaLimitatore();
    expect(l.proponi("m1", "1-0", 0)).toEqual({ dire: "1-0" });
    expect(l.proponi("m1", "2-0", 10 * S)).toEqual({
      dire: null,
      traMs: 20 * S,
    });
    expect(l.proponi("m1", "3-0", 30 * S)).toEqual({ dire: "3-0" });
  });

  it("partite diverse non si limitano a vicenda", () => {
    const l = creaLimitatore();
    expect(l.proponi("m1", "a", 0).dire).toBe("a");
    expect(l.proponi("m2", "b", 1 * S).dire).toBe("b");
    expect(l.proponi("m1", "c", 2 * S).dire).toBeNull();
  });

  it("intervallo configurabile", () => {
    const l = creaLimitatore(5 * S);
    expect(l.intervalloMs).toBe(5 * S);
    l.proponi("m1", "a", 0);
    expect(l.proponi("m1", "b", 4 * S).dire).toBeNull();
    expect(l.proponi("m1", "c", 5 * S).dire).toBe("c");
  });

  it("nella finestra tiene solo il testo più recente e lo dice alla riapertura", () => {
    const l = creaLimitatore();
    l.proponi("m1", "1-0", 0);
    l.proponi("m1", "2-0", 5 * S);
    l.proponi("m1", "3-0", 6 * S);
    expect(l.prossimo()).toBe(30 * S);
    expect(l.maturi(29 * S)).toEqual([]);
    expect(l.maturi(30 * S)).toEqual(["3-0"]);
    expect(l.maturi(31 * S)).toEqual([]);
    // Said at 30 s: the next window starts there.
    expect(l.proponi("m1", "4-0", 40 * S).dire).toBeNull();
    expect(l.prossimo()).toBe(60 * S);
  });

  it("scarta il testo in attesa (es. arriva il risultato)", () => {
    const l = creaLimitatore();
    l.proponi("m1", "1-0", 0);
    l.proponi("m1", "2-0", 1 * S);
    l.scarta("m1");
    expect(l.prossimo()).toBeNull();
    expect(l.maturi(60 * S)).toEqual([]);
  });
});

const match = (over: Partial<LiveMatch> = {}): LiveMatch => ({
  id: "m1",
  court: "Campo 1",
  groupId: "g",
  groupLabel: "Girone A",
  home: "A",
  away: "B",
  sets: [],
  ...over,
});
const score = (m: LiveMatch): LiveEvent => ({
  type: "score",
  match: m,
  seq: 1,
  savedAt: "2027-06-12T08:00:00.000Z",
});
const partial = { home: 3, away: 2, updatedAt: "2027-06-12T08:00:00.000Z" };

describe("chiavi", () => {
  it("solo il parziale di una partita in corso è limitato", () => {
    expect(chiaveParziale(score(match({ state: "in_corso", partial })))).toBe(
      "m1",
    );
    expect(chiaveParziale(score(match({ state: "in_corso" })))).toBeNull();
    expect(
      chiaveParziale(
        score(match({ state: "conclusa", partial, sets: [[21, 18]] })),
      ),
    ).toBeNull();
  });

  it("il risultato non è limitato ma libera la chiave della partita", () => {
    expect(
      chiaveRisultato(score(match({ state: "conclusa", sets: [[21, 18]] }))),
    ).toBe("m1");
    expect(
      chiaveRisultato(score(match({ state: "in_corso", partial }))),
    ).toBeNull();
  });
});
