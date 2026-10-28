import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent, LiveMatch, LiveSync } from "@/lib/live/types";
import { LiveTappa } from "./live-tappa";
import { TestEventSource, testConnection } from "./test-utils";

const ME = "i1";
const player = (id: string) => ({ id, name: `Nome ${id}` });

const mia: LiveMatch = {
  id: "mia",
  court: "Campo 1",
  groupId: "g1",
  groupLabel: "Girone A",
  home: "Uno/Due",
  away: "Tre/Quattro",
  sets: [],
  stageId: "t",
  category: "M",
  round: 1,
  state: "programmata",
  players: {
    home: [player(ME), player("i2")],
    away: [player("i3"), player("i4")],
  },
};

const altra: LiveMatch = {
  ...mia,
  id: "altra",
  court: "Campo 2",
  groupId: "g2",
  groupLabel: "Girone B",
  category: "F",
  state: "in_corso",
  sets: [[9, 7]],
  players: {
    home: [player("f1"), player("f2")],
    away: [player("f3"), player("f4")],
  },
};

const initial: LiveSync = {
  snapshot: {
    seq: 0,
    updatedAt: "2027-06-12T08:00:00.000Z",
    matches: [mia, altra],
    groups: [
      {
        id: "g1",
        label: "Girone A",
        stageId: "t",
        category: "M",
        rows: [ME, "i2", "i3", "i4"].map((id, i) => ({
          position: i + 1,
          pair: `Nome ${id}`,
          playerId: id,
          played: 0,
          won: 0,
          points: 0,
        })),
      },
    ],
    overall: [],
    pendingScores: [],
  },
  syncedAt: "2027-06-12T08:00:00.000Z",
};

async function renderLive() {
  render(
    <LiveTappa
      tappaId="t"
      initial={initial}
      me={ME}
      fasi={{ M: "gold", F: "silver" }}
      connection={testConnection(initial)}
    />,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

const score = (seq: number, match: LiveMatch): LiveEvent => ({
  seq,
  savedAt: "2027-06-12T08:31:00.000Z",
  type: "score",
  match,
});

describe("LiveTappa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("la mia partita e il mio girone in evidenza, con «Tu» a testo", async () => {
    await renderLive();
    const mie = screen.getByTestId("live-mie-partite");
    expect(within(mie).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Nome i1 (tu) e Nome i2 contro Nome i3 e Nome i4",
    );
    const girone = screen.getByRole("region", {
      name: "Il tuo girone · Girone A",
    });
    expect(within(girone).getAllByText("Tu").length).toBeGreaterThan(0);
    expect(within(girone).getAllByText("Gold").length).toBeGreaterThan(0);
    // BLVS-47: the group card leads to w-girone.
    expect(
      within(girone).getByRole("link", { name: /^Apri il girone/ }),
    ).toHaveAttribute("href", "/tappe/t/gironi/g1");

    const inCampo = screen.getByTestId("live-in-campo");
    expect(within(inCampo).getByText("Silver")).toBeInTheDocument();
    expect(within(inCampo).getByText("Live")).toBeInTheDocument();
  });

  it("un solo messaggio polite; ignora le altre tappe", async () => {
    await renderLive();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);

    await act(async () => {
      TestEventSource.last!.send(
        score(1, { ...mia, stageId: "altra-tappa", sets: [[1, 0]] }),
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      document.querySelector("[data-slot=live-announcer]"),
    ).toHaveTextContent("");

    await act(async () => {
      TestEventSource.last!.send(
        score(2, { ...mia, state: "conclusa", sets: [[19, 21]] }),
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      document.querySelector("[data-slot=live-announcer]"),
    ).toHaveTextContent("La tua partita: 19-21");
    expect(screen.getByTestId("live-mie-partite")).toHaveTextContent("19–21");
    expect(screen.getByTestId("live-mie-partite")).toHaveTextContent("Finita");
  });

  it("il parziale arriva senza ricaricare, il focus resta fermo, una sola regione polite (BLVS-37)", async () => {
    await renderLive();
    const focus = document.createElement("button");
    document.body.append(focus);
    focus.focus();
    const parziale = (seq: number, home: number, away: number) =>
      score(seq, {
        ...mia,
        state: "in_corso",
        partial: { home, away, updatedAt: "2027-06-12T08:31:00.000Z" },
      });

    await act(async () => {
      TestEventSource.last!.send(parziale(1, 14, 11));
      await vi.advanceTimersByTimeAsync(0);
    });
    const mie = screen.getByTestId("live-mie-partite");
    expect(within(mie).getByTestId("punteggio-parziale")).toHaveTextContent(
      "Parziale: Nome i1 e Nome i2 14, Nome i3 e Nome i4 11",
    );
    expect(mie).toHaveTextContent("Non entra in classifica");
    const announcer = document.querySelector("[data-slot=live-announcer]");
    expect(announcer).toHaveTextContent("La tua partita, parziale: 14-11");

    // Within 30 s the next partial is shown but not read.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      TestEventSource.last!.send(parziale(2, 15, 11));
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(within(mie).getByTestId("punteggio-parziale")).toHaveTextContent(
      "15, Nome i3 e Nome i4 11",
    );
    expect(announcer).not.toHaveTextContent("15-11");
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(document.activeElement).toBe(focus);

    // The standing of the group is untouched.
    const girone = screen.getByRole("region", {
      name: "Il tuo girone · Girone A",
    });
    expect(girone).not.toHaveTextContent("14");
    focus.remove();
  });
});
