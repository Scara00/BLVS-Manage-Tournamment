import { describe, expect, it } from "vitest";
import { announcementFor, statusAnnouncement } from "./announce";
import type { LiveEvent, LiveMatch } from "./types";

const match: LiveMatch = {
  id: "m1",
  court: "Campo 1",
  groupId: "a",
  groupLabel: "Girone A",
  home: "Rossi / Bianchi",
  away: "Marino / Greco",
  sets: [[21, 18]],
};
const meta = { seq: 1, savedAt: "2026-06-14T08:30:00.000Z" };

describe("announcementFor", () => {
  it("annuncia l'avvio dei gironi di un tabellone", () => {
    const event: LiveEvent = {
      ...meta,
      type: "phase-started",
      phase: {
        id: "cagliari:M",
        stageId: "cagliari",
        label: "Tappa 3 · Cagliari, maschile",
        category: "M",
        phase: "gironi_iniziali",
        matches: 9,
      },
    };
    expect(announcementFor(event)).toBe(
      "Tappa 3 · Cagliari, maschile: iniziati i gironi, 9 partite da giocare",
    );
  });

  it("annuncia il cambio di una partita di un tabellone", () => {
    const board = {
      id: "jesolo:M",
      stageId: "jesolo",
      category: "M" as const,
      label: "Tappa 1 · Jesolo, maschile",
      change: "Girone A · turno 2: partita conclusa",
      updatedAt: meta.savedAt,
      matches: [],
    };
    expect(announcementFor({ ...meta, type: "board-matches", board })).toBe(
      "Tappa 1 · Jesolo, maschile: Girone A · turno 2: partita conclusa",
    );
    expect(
      announcementFor({
        ...meta,
        type: "board-matches",
        board: { ...board, change: null },
      }),
    ).toBe("Tappa 1 · Jesolo, maschile: partite aggiornate");
  });

  it("annuncia le partite da inserire della tappa", () => {
    const event: LiveEvent = {
      ...meta,
      type: "pending-scores",
      stage: { id: "jesolo", label: "Tappa 1 · Jesolo", count: 2 },
    };
    expect(announcementFor(event)).toBe(
      "Tappa 1 · Jesolo: 2 partite da inserire",
    );
  });

  it("annuncia il nuovo risultato con il girone", () => {
    const event: LiveEvent = { ...meta, type: "score", match };
    expect(announcementFor(event)).toBe("Girone A: nuovo risultato 21-18");
  });

  it("usa l'ultimo set giocato", () => {
    const event: LiveEvent = {
      ...meta,
      type: "score",
      match: {
        ...match,
        sets: [
          [21, 18],
          [15, 21],
          [7, 3],
        ],
      },
    };
    expect(announcementFor(event)).toBe("Girone A: nuovo risultato 7-3");
  });

  it("annuncia la classifica del girone senza leggerne le righe", () => {
    const event: LiveEvent = {
      ...meta,
      type: "group-standings",
      group: {
        id: "a",
        label: "Girone A",
        rows: [{ position: 1, pair: "X / Y", played: 1, won: 1, points: 3 }],
      },
    };
    expect(announcementFor(event)).toBe("Classifica Girone A aggiornata");
  });

  it("annuncia la classifica generale", () => {
    const event: LiveEvent = { ...meta, type: "overall-standings", rows: [] };
    expect(announcementFor(event)).toBe("Classifica generale aggiornata");
  });
});

describe("statusAnnouncement", () => {
  const freshAt = "2026-06-14T08:30:00.000Z"; // 10:30 a Roma (CEST)

  it("avvisa quando la connessione cade", () => {
    expect(statusAnnouncement("live", "offline", freshAt)).toBe(
      "Connessione persa: dati non aggiornati dalle 10:30",
    );
    expect(statusAnnouncement("live", "reconnecting", freshAt)).toBe(
      "Connessione persa: dati non aggiornati dalle 10:30",
    );
  });

  it("avvisa quando torna", () => {
    expect(statusAnnouncement("reconnecting", "live", freshAt)).toBe(
      "Connessione ripristinata: dati aggiornati",
    );
  });

  it("tace alla prima connessione e tra un tentativo e l'altro", () => {
    expect(statusAnnouncement(null, "connecting", freshAt)).toBeNull();
    expect(statusAnnouncement("connecting", "live", freshAt)).toBeNull();
    expect(statusAnnouncement("reconnecting", "offline", freshAt)).toBeNull();
  });
});
