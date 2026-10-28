import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestEventSource, testConnection } from "@/components/live/test-utils";
import type { LiveEvent } from "@/lib/live/types";
import type { StageBoard } from "@/lib/tabellone/types";
import {
  ME_FIXTURE,
  stageFixture,
  syncFixture,
  type ScenarioTabellone,
} from "./fixtures";
import { TabelloneLive } from "./tabellone";

async function renderTabellone(
  scenario: ScenarioTabellone = "gironi_iniziali",
  me: string | null = ME_FIXTURE,
) {
  const sync = syncFixture(stageFixture(scenario));
  render(
    <TabelloneLive
      tappaId="t"
      initial={sync}
      me={me}
      connection={testConnection(sync)}
    />,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

const evento = (seq: number, stage: StageBoard): LiveEvent => ({
  seq,
  savedAt: "2027-06-12T08:35:00.000Z",
  type: "stage-board",
  stage,
});

const fasi = (categoria: "M" | "F") =>
  within(screen.getByTestId(`board-${categoria}`)).getByRole("list", {
    name: new RegExp(`^Fasi del tabellone`),
  });

describe("TabelloneLive", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // jsdom has no layout.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("le fasi a testo, la corrente con aria-current", async () => {
    await renderTabellone("gironi_gold_silver");
    const passi = within(fasi("M")).getAllByRole("listitem");
    expect(passi.map((p) => p.textContent)).toEqual([
      "IscrizioniFatta",
      "Gironi inizialiFatta",
      "Gironi gold e silverAdesso",
      "FinaliDa fare",
      "ConclusaDa fare",
    ]);
    const correnti = passi.filter((p) => p.getAttribute("aria-current"));
    expect(correnti).toHaveLength(1);
    expect(correnti[0]).toHaveAttribute("aria-current", "step");
    expect(correnti[0]).toHaveTextContent("Gironi gold e silver");
  });

  it("la mia posizione per prima, con «Apri il tuo girone» verso il mio girone", async () => {
    await renderTabellone("gironi_iniziali");
    const mia = screen.getByRole("region", { name: "La tua posizione" });
    expect(mia).toHaveTextContent("1°");
    expect(mia).toHaveTextContent("Girone A");
    expect(mia).toHaveTextContent("Per ora sopra la linea: gironi gold");
    const link = within(mia).getByRole("link", { name: "Apri il tuo girone" });
    expect(link).toHaveAttribute("href", "#girone-g-a");

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(link);
    expect(document.activeElement).toBe(document.getElementById("girone-g-a"));
  });

  it("ogni girone mostra la linea di taglio, la mia parte detta con «tu»", async () => {
    await renderTabellone("gironi_iniziali");
    const gironi = screen.getAllByTestId("girone-tabellone");
    expect(gironi.length).toBeGreaterThanOrEqual(2);
    for (const g of gironi) {
      expect(within(g).getByTestId("taglio")).toHaveTextContent(
        "Linea di taglio dopo il 2° posto: sopra gironi gold, sotto gironi silver.",
      );
    }
    const mio = document.getElementById("girone-g-a")!;
    expect(within(mio).getByTestId("taglio-mio")).toHaveTextContent(
      "Tu: per ora sopra la linea: gironi gold.",
    );
    expect(mio.querySelectorAll("tr[data-taglio=dopo]")).toHaveLength(1);
  });

  it("i gironi del livello giocato restano sotto, chiusi", async () => {
    await renderTabellone("gironi_gold_silver");
    const board = screen.getByTestId("board-M");
    const details = board.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details).toHaveTextContent("Gironi iniziali · fase giocata");
    // My place is in my most advanced group.
    expect(
      screen.getByRole("region", { name: "La tua posizione" }),
    ).toHaveTextContent("Gold A");
  });

  it("un aggiornamento cambia le righe, un solo annuncio breve, focus fermo", async () => {
    await renderTabellone("gironi_iniziali");
    const focus = document.createElement("button");
    document.body.append(focus);
    focus.focus();

    await act(async () => {
      TestEventSource.last!.send(
        evento(1, { ...stageFixture("gironi_iniziali"), stageId: "altra" }),
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    const announcer = document.querySelector("[data-slot=live-announcer]");
    expect(announcer).toHaveTextContent("");

    await act(async () => {
      TestEventSource.last!.send(
        evento(
          2,
          stageFixture("gironi_gold_silver", {
            change: "Girone B · turno 3: partita conclusa",
          }),
        ),
      );
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(announcer).toHaveTextContent(
      "Girone B · turno 3: partita conclusa. Sei 1° a pari merito in Gold A",
    );
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(document.activeElement).toBe(focus);
    expect(
      within(fasi("M")).getByRole("listitem", { current: "step" }),
    ).toHaveTextContent("Gironi gold e silver");
    focus.remove();
  });

  it("alla chiusura del tabellone la fase diventa «Conclusa»", async () => {
    await renderTabellone("finali");
    await act(async () => {
      TestEventSource.last!.send(
        evento(1, stageFixture("conclusa", { change: "tabellone concluso" })),
      );
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(
      within(fasi("M")).getByRole("listitem", { current: "step" }),
    ).toHaveTextContent("Conclusa");
    expect(
      document.querySelector("[data-slot=live-announcer]"),
    ).toHaveTextContent("Tabellone concluso");
  });

  it("spettatore: nessuna posizione; tappa annullata: un messaggio", async () => {
    await renderTabellone("gironi_iniziali", null);
    expect(
      screen.getByRole("region", { name: "La tua posizione" }),
    ).toHaveTextContent("Non risulti iscritto");
    expect(
      screen.queryByRole("link", { name: "Apri il tuo girone" }),
    ).not.toBeInTheDocument();
  });

  it("tappa annullata: niente fasi", async () => {
    const sync = syncFixture(
      stageFixture("iscrizioni", { statoTappa: "annullata" }),
    );
    render(
      <TabelloneLive
        tappaId="t"
        initial={sync}
        me={ME_FIXTURE}
        connection={testConnection(sync)}
      />,
    );
    expect(screen.getByTestId("tappa-annullata")).toBeInTheDocument();
    expect(screen.queryByTestId("fasi-tabellone")).not.toBeInTheDocument();
  });
});
