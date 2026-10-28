import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestEventSource, testConnection } from "@/components/live/test-utils";
import type { LiveEvent, LiveSync, StageStandings } from "@/lib/live/types";
import { ClassificaTappaLive } from "./classifica-tappa-live";
import {
  conclusa,
  definitiva,
  inAttesa,
  inCorso,
  ME,
  parita,
  ritiro,
  syncDi,
  TAPPA,
} from "./fixtures";

async function renderClassifica(
  standings: StageStandings = definitiva,
  {
    me = ME,
    mostraLaTuaTappa = true,
    reducedMotion = true,
  }: {
    me?: string | null;
    mostraLaTuaTappa?: boolean;
    reducedMotion?: boolean;
  } = {},
) {
  const initial: LiveSync = syncDi(standings);
  render(
    <ClassificaTappaLive
      initial={initial}
      tappaId={TAPPA}
      categoria="M"
      me={me}
      mostraLaTuaTappa={mostraLaTuaTappa}
      connection={testConnection(initial)}
      reducedMotion={reducedMotion}
    />,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
}

const evento = (
  seq: number,
  standings: StageStandings,
  savedAt = "2026-07-18T08:31:00.000Z",
): LiveEvent => ({ seq, savedAt, type: "stage-standings", standings });

async function invia(event: LiveEvent) {
  await act(async () => {
    TestEventSource.last!.send(event);
    await vi.advanceTimersByTimeAsync(0);
  });
}

const tabelle = () => screen.getAllByRole("table");
const annuncio = () => document.querySelector("[data-slot=live-announcer]");
/** Points shown in the table rows of one final. */
const punti = (tabella: HTMLElement) =>
  within(tabella)
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[1].textContent?.match(/\d+/)?.[0]);

describe("ClassificaTappa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("punti per posizione: gold 12, 8, 4, 2 e silver 8, 6, 2, 1", async () => {
    await renderClassifica();
    const [gold, silver] = tabelle();
    expect(gold).toHaveAccessibleName("Finale gold · punti 12, 8, 4, 2");
    expect(silver).toHaveAccessibleName("Finale silver · punti 8, 6, 2, 1");
    expect(punti(gold)).toEqual(["12", "8", "4", "2"]);
    expect(punti(silver)).toEqual(["8", "6", "2", "1"]);
    // Overall position continues from gold to silver.
    expect(
      within(silver)
        .getAllByRole("row")
        .slice(1)
        .map((tr) => tr.querySelector("td")?.textContent),
    ).toEqual(["5", "6", "7", "8"]);
  });

  it("tabella con th scope: colonne, nome come intestazione di riga", async () => {
    await renderClassifica();
    const [gold] = tabelle();
    const colonne = within(gold).getAllByRole("columnheader");
    expect(colonne.map((th) => th.textContent)).toEqual([
      "Posizione",
      "Giocatore",
      "Punti",
    ]);
    expect(colonne.every((th) => th.getAttribute("scope") === "col")).toBe(
      true,
    );
    const righe = within(gold).getAllByRole("rowheader");
    expect(righe.every((th) => th.getAttribute("scope") === "row")).toBe(true);
    expect(righe[0]).toHaveTextContent("Luca RossiTUsei tu");
  });

  it("gold e silver separati da una linea, con etichette a testo", async () => {
    await renderClassifica();
    const linee = document.querySelectorAll("[data-slot=separatore-finali]");
    expect(linee).toHaveLength(1);
    expect(linee[0].tagName).toBe("HR");
    expect(screen.getAllByText("Finale gold · punti 12, 8, 4, 2").length).toBe(
      2,
    );
  });

  it("punti provvisori a testo finché il tabellone non è chiuso", async () => {
    await renderClassifica();
    const [gold] = tabelle();
    expect(within(gold).getAllByText("provvisori")).toHaveLength(4);
    expect(screen.getByTestId("classifica-tappa-stato")).toHaveTextContent(
      "Tutte le posizioni sono decise",
    );
  });

  it("alla chiusura l'etichetta sparisce senza ricaricare: un annuncio, focus fermo, nuovo orario", async () => {
    await renderClassifica();
    const categoria = screen.getByRole("heading", {
      name: "Classifica di tappa maschile",
    });
    categoria.tabIndex = -1;
    categoria.focus();

    await invia(evento(1, { ...conclusa, change: "punti definitivi" }));

    expect(screen.queryByText("provvisori")).not.toBeInTheDocument();
    expect(annuncio()).toHaveTextContent(
      "Classifica di tappa maschile aggiornata: punti definitivi: la tua posizione: 1ª, 12 punti",
    );
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(categoria).toHaveFocus();
    expect(
      screen.getByRole("region", { name: "Stato degli aggiornamenti" }),
    ).toHaveTextContent("Ultimo aggiornamento alle 10:31");
    expect(screen.getByTestId("classifica-tappa-stato")).toHaveTextContent(
      "Tabellone chiuso: i punti sono definitivi.",
    );
  });

  it("anche il solo board-closed dello stesso tabellone toglie «provvisori», senza annuncio", async () => {
    await renderClassifica();
    await invia({
      seq: 1,
      savedAt: "2026-07-18T08:32:00.000Z",
      type: "board-closed",
      board: {
        id: `${TAPPA}:M`,
        stageId: TAPPA,
        category: "M",
        label: "Tappa 1 · Jesolo, maschile",
        closedAt: "2026-07-18T08:32:00.000Z",
        stageConcluded: false,
        points: [],
      },
    });
    expect(screen.queryByText("provvisori")).not.toBeInTheDocument();
    expect(annuncio()).toHaveTextContent("");
  });

  it("una posizione diventa definitiva dopo un salvataggio", async () => {
    await renderClassifica(inCorso);
    const riga = () =>
      screen
        .getAllByTestId("riga-e")
        .find((el) => el.tagName === "TR") as HTMLElement;
    expect(riga()).toHaveTextContent("non ancora definitiva");
    await invia(evento(1, { ...definitiva, change: "4 posizioni definitive" }));
    expect(riga()).not.toHaveTextContent("non ancora definitiva");
    expect(annuncio()).toHaveTextContent("4 posizioni definitive");
  });

  it("ignora la classifica dell'altro tabellone", async () => {
    await renderClassifica();
    await invia(
      evento(1, { ...conclusa, id: `${TAPPA}:F`, category: "F", rows: [] }),
    );
    expect(screen.getAllByText("provvisori").length).toBeGreaterThan(0);
    expect(annuncio()).toHaveTextContent("");
  });

  it("parità da risolvere e ritiro a testo", async () => {
    await renderClassifica(parita);
    expect(
      within(tabelle()[0]).getAllByText("(parità da risolvere)"),
    ).toHaveLength(3);
    document.body.innerHTML = "";
    await renderClassifica(ritiro);
    expect(within(tabelle()[1]).getByText("(ritirato)")).toBeInTheDocument();
  });

  it("con movimento ridotto niente palette: cifre semplici", async () => {
    await renderClassifica(definitiva, { reducedMotion: true });
    expect(document.querySelector("[data-slot=flip-digits]")).toBeNull();
    expect(
      document.querySelectorAll("[data-slot=punti-cifre]").length,
    ).toBeGreaterThan(0);
  });

  it("senza movimento ridotto i punti sono a palette (font.mono)", async () => {
    await renderClassifica(definitiva, { reducedMotion: false });
    expect(
      document.querySelectorAll("[data-slot=flip-digits]").length,
    ).toBeGreaterThan(0);
  });
});

describe("La tua tappa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const sezione = () => screen.getByRole("region", { name: /La tua tappa/ });

  it("posizione, finale e punti attuali con «provvisori» a testo", async () => {
    await renderClassifica();
    expect(within(sezione()).getByText("1ª")).toBeInTheDocument();
    expect(within(sezione()).getByText("Finale gold")).toBeInTheDocument();
    expect(within(sezione()).getByText("provvisori")).toBeInTheDocument();
    expect(screen.getByTestId("la-tua-tappa-punti")).toHaveTextContent(
      "12 punti provvisori: diventano definitivi",
    );
  });

  it("punti definitivi a tabellone chiuso", async () => {
    await renderClassifica(conclusa);
    expect(within(sezione()).queryByText("provvisori")).not.toBeInTheDocument();
    expect(screen.getByTestId("la-tua-tappa-punti")).toHaveTextContent(
      "12 punti: punti definitivi.",
    );
  });

  it("chi non è in finale: 0 punti", async () => {
    await renderClassifica(definitiva, { me: "zz" });
    expect(sezione()).toHaveTextContent(
      "Non sei in finale: 0 punti in questa tappa.",
    );
  });

  it("prima delle finali lo dice a testo", async () => {
    await renderClassifica(inAttesa);
    expect(sezione()).toHaveTextContent("Le finali non sono ancora iniziate");
    expect(
      screen.getByText("Ancora nessun giocatore in finale."),
    ).toBeVisible();
  });

  it("nascosta per chi non è iscritto a questo tabellone", async () => {
    await renderClassifica(definitiva, { mostraLaTuaTappa: false });
    expect(
      screen.queryByRole("region", { name: /La tua tappa/ }),
    ).not.toBeInTheDocument();
  });
});
