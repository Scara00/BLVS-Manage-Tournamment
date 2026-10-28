import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestEventSource, testConnection } from "@/components/live/test-utils";
import type {
  GroupStandings,
  LiveEvent,
  LiveMatch,
  LiveSync,
} from "@/lib/live/types";
import { LiveGirone } from "./live-girone";

const ME = "i1";
const player = (id: string) => ({ id, name: `Nome ${id}` });
const SAVED = "2027-06-12T08:31:00.000Z";

const turno = (round: number, over: Partial<LiveMatch> = {}): LiveMatch => ({
  id: `g1-t${round}`,
  court: "Campo 1",
  groupId: "g1",
  groupLabel: "Girone A",
  home: "A",
  away: "B",
  sets: [],
  stageId: "t",
  category: "M",
  round,
  state: "programmata",
  players: {
    home: [player(ME), player("i2")],
    away: [player("i3"), player("i4")],
  },
  ...over,
});

const standing = (order: string[]): GroupStandings => ({
  id: "g1",
  label: "Girone A",
  stageId: "t",
  category: "M",
  rows: order.map((id, i) => ({
    position: i + 1,
    pair: `Nome ${id}`,
    playerId: id,
    played: 1,
    won: i < 2 ? 1 : 0,
    points: 21,
    against: 19,
    diff: 2,
  })),
});

const initial: LiveSync = {
  snapshot: {
    seq: 0,
    updatedAt: "2027-06-12T08:00:00.000Z",
    matches: [turno(1, { state: "in_corso" }), turno(2), turno(3)],
    groups: [standing([ME, "i2", "i3", "i4"])],
    overall: [],
    pendingScores: [],
  },
  syncedAt: "2027-06-12T08:00:00.000Z",
};

async function renderGirone() {
  render(
    <LiveGirone
      tappaId="t"
      girone={{
        id: "g1",
        nome: "Girone A",
        fase: "iniziale",
        gironiDellaFase: 2,
      }}
      initial={initial}
      me={ME}
      connection={testConnection(initial)}
      reducedMotion
    />,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

const send = async (event: LiveEvent) => {
  await act(async () => {
    TestEventSource.last!.send(event);
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe("LiveGirone", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("partita in corso in evidenza con i nomi interi, le altre a righe con lo stato a testo", async () => {
    await renderGirone();
    const inCorso = screen.getByTestId("girone-in-corso");
    expect(
      within(inCorso).getByRole("heading", { level: 3 }),
    ).toHaveTextContent("Nome i1 (tu) e Nome i2 contro Nome i3 e Nome i4");
    expect(within(inCorso).getByText("Live")).toBeInTheDocument();
    const altre = screen.getByTestId("girone-partite");
    expect(within(altre).getAllByRole("listitem")).toHaveLength(2);
    expect(altre).toHaveTextContent("Turno 2 · Da giocare");
    expect(
      screen.getByRole("link", { name: /Regole dei gironi/ }),
    ).toHaveAttribute("href", "/regole#spareggi-girone");
  });

  it("un solo messaggio per risultato; la classifica riordinata non si legge; focus fermo", async () => {
    await renderGirone();
    const focus = document.createElement("button");
    document.body.append(focus);
    focus.focus();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    const announcer = document.querySelector("[data-slot=live-announcer]")!;

    await send({
      seq: 1,
      savedAt: SAVED,
      type: "score",
      match: turno(1, { state: "conclusa", sets: [[19, 21]] }),
    });
    await send({
      seq: 2,
      savedAt: SAVED,
      type: "group-standings",
      group: standing(["i3", "i4", ME, "i2"]),
    });

    expect(announcer).toHaveTextContent("La tua partita: 19-21");
    expect(announcer.textContent).toBe("La tua partita: 19-21");
    expect(screen.getByTestId("girone-in-corso")).toHaveTextContent(
      "Nessuna partita in corso nel girone.",
    );
    expect(screen.getByTestId("girone-partite")).toHaveTextContent(
      "Turno 1 · Finita",
    );
    const table = screen.getByRole("table", { name: "Classifica Girone A" });
    expect(within(table).getAllByRole("rowheader")[0]).toHaveTextContent(
      "Nome i3",
    );
    expect(document.activeElement).toBe(focus);
    focus.remove();
  });

  it("ignora gli altri gironi", async () => {
    await renderGirone();
    await send({
      seq: 1,
      savedAt: SAVED,
      type: "score",
      match: turno(1, { groupId: "g2", state: "conclusa", sets: [[21, 3]] }),
    });
    expect(
      document.querySelector("[data-slot=live-announcer]"),
    ).toHaveTextContent("");
    expect(screen.getByTestId("girone-in-corso")).toHaveTextContent("Live");
  });
});
