import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chiaveParziale, chiaveRisultato } from "@/lib/live/limita-annunci";
import type { LiveEvent } from "@/lib/live/types";
import { LiveAnnouncer } from "./live-announcer";
import { LiveProvider } from "./live-provider";
import { LiveGroupStandings } from "./live-views";
import {
  baseSnapshot,
  baseSync,
  TestEventSource,
  testConnection,
} from "./test-utils";

const score = (seq: number, sets: [number, number][], groupId = "a") =>
  ({
    seq,
    savedAt: "2026-06-14T08:30:00.000Z",
    type: "score",
    match: {
      ...baseSnapshot.matches[0],
      groupId,
      groupLabel: groupId === "a" ? "Girone A" : "Girone B",
      sets,
    },
  }) satisfies LiveEvent;

async function renderLive(ui: React.ReactNode) {
  render(
    <LiveProvider initial={baseSync} connection={testConnection()}>
      <button type="button">Altro</button>
      {ui}
    </LiveProvider>,
  );
  // Open the stream and let the resync resolve.
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

function region() {
  return document.querySelector<HTMLElement>("[data-slot=live-announcer]")!;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("LiveAnnouncer", () => {
  it("è una regione polite e atomica, vuota all'inizio", async () => {
    await renderLive(<LiveAnnouncer />);
    expect(region()).toHaveAttribute("aria-live", "polite");
    expect(region()).toHaveAttribute("aria-atomic", "true");
    expect(region()).toHaveTextContent("");
  });

  it("annuncia un nuovo risultato con un messaggio breve", async () => {
    await renderLive(<LiveAnnouncer />);
    act(() => TestEventSource.last!.send(score(1, [[21, 18]])));
    expect(region()).toHaveTextContent("Girone A: nuovo risultato 21-18");
  });

  it("non sposta il focus", async () => {
    await renderLive(<LiveAnnouncer />);
    const button = screen.getByRole("button", { name: "Altro" });
    button.focus();
    act(() => TestEventSource.last!.send(score(1, [[21, 18]])));
    expect(document.activeElement).toBe(button);
  });

  it("raggruppa una raffica di eventi in un solo annuncio", async () => {
    await renderLive(<LiveAnnouncer />);
    act(() => {
      TestEventSource.last!.send(score(1, [[21, 18]]));
    });
    act(() => {
      TestEventSource.last!.send({
        seq: 2,
        savedAt: "2026-06-14T08:30:00.000Z",
        type: "group-standings",
        group: baseSnapshot.groups[0],
      });
      TestEventSource.last!.send({
        seq: 3,
        savedAt: "2026-06-14T08:30:00.000Z",
        type: "overall-standings",
        rows: [],
      });
    });
    // Still the first message until the window ends.
    expect(region()).toHaveTextContent("Girone A: nuovo risultato 21-18");
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    expect(region()).toHaveTextContent(
      "Classifica Girone A aggiornata. Classifica generale aggiornata",
    );
  });

  it("annuncia solo i cambiamenti che riguardano la pagina", async () => {
    await renderLive(<LiveAnnouncer groupId="a" />);
    act(() => TestEventSource.last!.send(score(1, [[3, 1]], "b")));
    expect(region()).toHaveTextContent("");
    act(() => TestEventSource.last!.send(score(2, [[4, 1]], "a")));
    expect(region()).toHaveTextContent("Girone A: nuovo risultato 4-1");
  });

  it("non legge le righe riordinate della classifica", async () => {
    await renderLive(
      <>
        <LiveAnnouncer />
        <LiveGroupStandings groupId="a" />
      </>,
    );
    act(() =>
      TestEventSource.last!.send({
        seq: 1,
        savedAt: "2026-06-14T08:30:00.000Z",
        type: "group-standings",
        group: {
          ...baseSnapshot.groups[0],
          rows: [...baseSnapshot.groups[0].rows].reverse(),
        },
      }),
    );
    expect(region()).toHaveTextContent("Classifica Girone A aggiornata");
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(region()).not.toHaveTextContent("Marino");
  });

  it("annuncia la perdita e il ritorno della connessione", async () => {
    await renderLive(<LiveAnnouncer />);
    act(() => TestEventSource.last!.emit("error"));
    expect(region()).toHaveTextContent(
      "Connessione persa: dati non aggiornati dalle 10:00",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
      TestEventSource.last!.emit("open");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(region()).toHaveTextContent(
      "Connessione ripristinata: dati aggiornati",
    );
  });
});

describe("LiveAnnouncer limita (BLVS-37)", () => {
  const parziale = (seq: number, home: number, away: number) =>
    ({
      seq,
      savedAt: "2026-06-14T08:30:00.000Z",
      type: "score",
      match: {
        ...baseSnapshot.matches[0],
        sets: [],
        state: "in_corso",
        partial: { home, away, updatedAt: "2026-06-14T08:30:00.000Z" },
      },
    }) satisfies LiveEvent;
  const risultato = (seq: number) =>
    ({
      seq,
      savedAt: "2026-06-14T08:31:00.000Z",
      type: "score",
      match: {
        ...baseSnapshot.matches[0],
        state: "conclusa",
        sets: [[21, 18]],
        partial: null,
      },
    }) satisfies LiveEvent;

  async function renderLimitato(intervalloMs?: number) {
    await renderLive(
      <LiveAnnouncer
        intervalMs={10}
        limita={{
          chiave: chiaveParziale,
          libera: chiaveRisultato,
          intervalloMs,
        }}
      />,
    );
    const said: string[] = [];
    new MutationObserver(() => {
      if (region().textContent) said.push(region().textContent!);
    }).observe(region(), { childList: true, subtree: true });
    return said;
  }

  it("al massimo un parziale ogni 30 s per partita, poi il più recente", async () => {
    const said = await renderLimitato();
    act(() => TestEventSource.last!.send(parziale(1, 3, 2)));
    expect(region()).toHaveTextContent("Girone A: parziale 3-2");
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    act(() => TestEventSource.last!.send(parziale(2, 4, 2)));
    act(() => TestEventSource.last!.send(parziale(3, 5, 2)));
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(said.filter((t) => t.includes("parziale"))).toEqual([
      "Girone A: parziale 3-2",
    ]);
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(said.at(-1)).toBe("Girone A: parziale 5-2");
    expect(said).not.toContain("Girone A: parziale 4-2");
  });

  it("l'intervallo è configurabile", async () => {
    const said = await renderLimitato(1_000);
    act(() => TestEventSource.last!.send(parziale(1, 1, 0)));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    act(() => TestEventSource.last!.send(parziale(2, 2, 0)));
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(said).toEqual(["Girone A: parziale 1-0", "Girone A: parziale 2-0"]);
  });

  it("il risultato ufficiale non aspetta e scarta il parziale in attesa", async () => {
    const said = await renderLimitato();
    act(() => TestEventSource.last!.send(parziale(1, 19, 18)));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    act(() => TestEventSource.last!.send(parziale(2, 20, 18)));
    act(() => TestEventSource.last!.send(risultato(3)));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(said).toEqual([
      "Girone A: parziale 19-18",
      "Girone A: nuovo risultato 21-18",
    ]);
  });
});
