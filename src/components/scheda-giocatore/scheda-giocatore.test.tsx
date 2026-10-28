import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestEventSource, testConnection } from "@/components/live/test-utils";
import { NOME_ANONIMO } from "@/lib/classifica-generale/giocatore";
import { DEMO_ANONIMI, demoUtente } from "@/lib/demo/classifica-generale";
import type { LiveEvent, OverallStandings } from "@/lib/live/types";
import { standingsScheda, syncScheda } from "./fixtures";
import { SchedaGiocatoreLive } from "./scheda-giocatore-live";

const UNO = demoUtente("M", 1);
const ANONIMO = [...DEMO_ANONIMI][0];

async function renderScheda(
  utenteId: string,
  standings: OverallStandings = standingsScheda("M", "provvisoria"),
  me: string | null = UNO,
) {
  const initial = syncScheda(standings);
  render(
    <SchedaGiocatoreLive
      initial={initial}
      standingsId={standings.id}
      utenteId={utenteId}
      categoria={standings.category}
      stagione={standings.season!}
      me={me}
      connection={testConnection(initial)}
      reducedMotion
    />,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

const tabella = () => screen.getByRole("table");
const riepilogo = () => screen.getByTestId("scheda-riepilogo");

describe("SchedaGiocatore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nome, posizione, punti totali con «provvisori» e tappe giocate", async () => {
    await renderScheda(UNO);
    expect(screen.getByTestId("scheda-nome")).toHaveTextContent("Luca Rossi");
    expect(within(riepilogo()).getByText("TU")).toBeInTheDocument();
    expect(
      within(riepilogo()).getByRole("heading", {
        name: /Stagione 2026 · Maschile/,
      }),
    ).toBeInTheDocument();
    expect(within(riepilogo()).getByText("provvisori")).toBeInTheDocument();
    expect(within(riepilogo()).getByText("Tappe giocate")).toBeInTheDocument();
  });

  it("una riga per tappa, dalla più recente, con fase a testo e link alla classifica di tappa", async () => {
    await renderScheda(UNO);
    expect(
      within(tabella())
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Tappa", "Data", "Fase", "Posizione", "Punti"]);
    const righe = within(tabella()).getAllByRole("rowheader");
    expect(righe.map((r) => r.textContent)).toEqual([
      "Tappa 3 · Cagliari: classifica della tappa",
      "Tappa 2 · Rimini: classifica della tappa",
      "Tappa 1 · Jesolo: classifica della tappa",
    ]);
    expect(within(righe[2]).getByRole("link")).toHaveAttribute(
      "href",
      "/tappe/demo-cg-jesolo/classifica?categoria=M",
    );
    const jesolo = tabella().querySelector(
      "[data-testid='tappa-demo-cg-jesolo']",
    )!;
    expect(jesolo).toHaveTextContent("★Finale gold");
    expect(jesolo).toHaveAttribute("data-punti", "12");
    // The symbol is decoration: the word says the phase.
    expect(jesolo.querySelector("[aria-hidden='true']")).toHaveTextContent("★");
    const cagliari = tabella().querySelector(
      "[data-testid='tappa-demo-cg-cagliari']",
    )!;
    expect(cagliari).toHaveTextContent("provvisori");
    expect(cagliari).toHaveTextContent("non ancora definitiva");
  });

  it("silver e «Non in finale» a testo", async () => {
    await renderScheda(demoUtente("M", 12));
    expect(within(tabella()).getAllByText("Non in finale")).toHaveLength(3);
    expect(within(tabella()).getAllByText("fuori dalle finali")).toHaveLength(
      3,
    );
    await act(async () => {});
  });

  it("tutto definitivo: nessuna scritta «provvisori»", async () => {
    await renderScheda(demoUtente("M", 2), standingsScheda("M", "definitiva"));
    expect(screen.queryByText("provvisori")).not.toBeInTheDocument();
  });

  it("account cancellato: «Giocatore anonimo», nessun dato personale, niente TU", async () => {
    await renderScheda(ANONIMO, undefined, ANONIMO);
    expect(screen.getByTestId("scheda-nome")).toHaveTextContent(NOME_ANONIMO);
    expect(screen.getByTestId("scheda-anonimo")).toHaveTextContent(
      "Account cancellato",
    );
    expect(screen.queryByText("TU")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Alessandro|Greco/);
    expect(within(tabella()).getAllByRole("rowheader")).toHaveLength(3);
  });

  it("si aggiorna dal live e lo annuncia una volta", async () => {
    await renderScheda(UNO);
    const standings = standingsScheda("M", "provvisoria");
    const next: OverallStandings = {
      ...standings,
      change: "Tappa 3 · Cagliari: punti definitivi",
      rows: standings.rows.map((r) =>
        r.playerId === UNO
          ? {
              ...r,
              provisional: false,
              results: r.results?.map((t) => ({ ...t, provisional: false })),
            }
          : r,
      ),
    };
    const event: LiveEvent = {
      seq: 1,
      savedAt: "2026-07-18T10:31:00.000Z",
      type: "overall-standings",
      rows: [],
      standings: next,
    };
    await act(async () => {
      TestEventSource.last!.send(event);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("provvisori")).not.toBeInTheDocument();
    expect(
      document.querySelector("[data-slot=live-announcer]"),
    ).toHaveTextContent(
      /Scheda aggiornata: Tappa 3 · Cagliari: punti definitivi: Luca Rossi/,
    );
  });

  it("torna alla classifica generale della stessa stagione", async () => {
    await renderScheda(UNO);
    expect(screen.getByTestId("torna-classifica")).toHaveAttribute(
      "href",
      "/classifica?categoria=M&stagione=2026",
    );
  });
});
