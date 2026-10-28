import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestEventSource, testConnection } from "@/components/live/test-utils";
import type {
  LiveEvent,
  LiveSync,
  OverallPlayerRow,
  OverallStandings,
} from "@/lib/live/types";
import { ClassificaGeneraleLive } from "./classifica-generale-live";

const ME = "u1";

const row = (
  playerId: string,
  name: string,
  position: number,
  points: number,
  extra: Partial<OverallPlayerRow> = {},
): OverallPlayerRow => ({
  playerId,
  name,
  position,
  points,
  stages: 2,
  provisional: false,
  tied: false,
  ...extra,
});

const standings: OverallStandings = {
  id: "M:2026",
  category: "M",
  season: 2026,
  rows: [
    row("u2", "Marco Bianchi", 1, 20),
    row(ME, "Luca Rossi", 2, 16, { provisional: true }),
    row("u3", "Niccolò Esposito", 3, 0, { tied: true }),
    row("u4", "Matteo Romano", 3, 0, { tied: true }),
  ],
};

const initial: LiveSync = {
  snapshot: {
    seq: 0,
    updatedAt: "2026-07-18T08:00:00.000Z",
    matches: [],
    groups: [],
    overall: [],
    pendingScores: [],
    overallStandings: [standings],
  },
  syncedAt: "2026-07-18T08:00:00.000Z",
};

async function renderClassifica(me: string | null = ME) {
  render(
    <ClassificaGeneraleLive
      initial={initial}
      standingsId="M:2026"
      categoria="M"
      stagione={2026}
      me={me}
      connection={testConnection(initial)}
    />,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

const evento = (
  seq: number,
  next: OverallStandings,
  savedAt = "2026-07-18T08:31:00.000Z",
): LiveEvent => ({
  seq,
  savedAt,
  type: "overall-standings",
  rows: [],
  standings: next,
});

const annuncio = () => document.querySelector("[data-slot=live-announcer]");
const tabella = () => screen.getByRole("table");

describe("ClassificaGenerale", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tabella con intestazioni di colonna e di riga, badge TU e pari merito", async () => {
    await renderClassifica();
    expect(
      within(tabella())
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Posizione", "Giocatore", "Tappe giocate", "Punti"]);
    const intestazioni = within(tabella()).getAllByRole("rowheader");
    expect(intestazioni).toHaveLength(4);
    expect(intestazioni[1]).toHaveTextContent("Luca RossiTUsei tu");
    expect(intestazioni[2]).toHaveTextContent("(pari merito)");
    expect(tabella()).toHaveAccessibleName(
      "Classifica generale maschile · Stagione 2026",
    );
  });

  it("il nome apre la scheda del giocatore", async () => {
    await renderClassifica();
    expect(
      within(tabella()).getByRole("link", { name: "Marco Bianchi" }),
    ).toHaveAttribute(
      "href",
      "/classifica/giocatore/u2?categoria=M&stagione=2026",
    );
  });

  it("«La tua posizione» con posizione, punti provvisori a testo e tappe", async () => {
    await renderClassifica();
    const mia = screen.getByRole("region", { name: /La tua posizione/ });
    expect(within(mia).getByText("2ª")).toBeInTheDocument();
    expect(within(mia).getByText("provvisori")).toBeInTheDocument();
    expect(
      within(mia).getByText(/16 punti provvisori: diventano definitivi/),
    ).toBeInTheDocument();
  });

  it("chi non ha fatto l'accesso vede come entrare, senza badge TU", async () => {
    await renderClassifica(null);
    const mia = screen.getByRole("region", { name: "La tua posizione" });
    expect(within(mia).getByRole("link", { name: "Accedi" })).toHaveAttribute(
      "href",
      "/accesso?da=%2Fclassifica",
    );
    expect(screen.queryByText("TU")).not.toBeInTheDocument();
  });

  it("ricerca per nome: filtra senza cambiare le posizioni, dice quanti", async () => {
    await renderClassifica();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Cerca per nome" }),
      {
        target: { value: "niccolo" },
      },
    );
    const righe = within(tabella()).getAllByRole("rowheader");
    expect(righe).toHaveLength(1);
    expect(righe[0].closest("tr")).toHaveTextContent("3");
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 giocatore trovato.",
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("Nessun giocatore con questo nome.")).toBeVisible();
  });

  it("alla chiusura del tabellone la scritta «provvisori» sparisce senza ricaricare; un solo annuncio, focus fermo", async () => {
    await renderClassifica();
    const ricerca = screen.getByRole("searchbox");
    ricerca.focus();
    expect(screen.getAllByText("provvisori").length).toBeGreaterThan(0);

    await act(async () => {
      TestEventSource.last!.send(
        evento(1, {
          ...standings,
          change: "Tappa 3 · Cagliari: punti definitivi",
          rows: standings.rows.map((r) => ({ ...r, provisional: false })),
        }),
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("provvisori")).not.toBeInTheDocument();
    expect(annuncio()).toHaveTextContent(
      "Classifica generale maschile aggiornata: Tappa 3 · Cagliari: punti definitivi: la tua posizione: 2ª, 16 punti",
    );
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(ricerca).toHaveFocus();
    expect(
      screen.getByRole("region", { name: "Stato degli aggiornamenti" }),
    ).toHaveTextContent("Ultimo aggiornamento alle 10:31");
  });

  it("ignora le classifiche di altre categorie o stagioni", async () => {
    await renderClassifica();
    await act(async () => {
      TestEventSource.last!.send(
        evento(1, { ...standings, id: "F:2026", category: "F", rows: [] }),
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(annuncio()).toHaveTextContent("");
    expect(within(tabella()).getAllByRole("rowheader")).toHaveLength(4);
    expect(
      screen.getByRole("region", { name: "Stato degli aggiornamenti" }),
    ).toHaveTextContent("alle 10:00");
  });

  it("classifica vuota: nessuna ricerca, messaggio a testo", async () => {
    render(
      <ClassificaGeneraleLive
        initial={{
          ...initial,
          snapshot: {
            ...initial.snapshot,
            overallStandings: [{ ...standings, rows: [] }],
          },
        }}
        standingsId="M:2026"
        categoria="M"
        stagione={2026}
        me={ME}
        connect={false}
      />,
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Nessun giocatore in classifica/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/Non sei ancora in questa classifica/),
    ).toBeInTheDocument();
  });
});
