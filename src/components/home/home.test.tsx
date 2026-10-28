import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  gara,
  garaFinita,
  garaVuota,
  home,
  prossimaAperta,
  prossimaChiusa,
  prossimaIscritto,
} from "./fixtures";
import { HomeGiocatore } from "./home-giocatore";

const offline = { connect: false, initialStatus: "live" as const };

describe("w-home il giorno di gara", () => {
  test("saluta e mostra la barra Live compatta accanto al saluto", () => {
    render(<HomeGiocatore home={home(gara)} gara={offline} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Ciao, Luca" });
    const bar = screen.getByRole("region", {
      name: "Stato degli aggiornamenti",
    });
    expect(bar).toHaveAttribute("data-compact", "true");
    expect(h1.parentElement).toContainElement(bar);
  });

  test("mostra la mia partita da giocare", () => {
    render(<HomeGiocatore home={home(gara)} gara={offline} />);
    const partita = screen.getByTestId("home-mia-partita");
    expect(within(partita).getAllByRole("listitem")).toHaveLength(1);
    expect(partita).toHaveTextContent("Campo 3");
  });

  test("mostra la posizione nel girone e in generale", () => {
    render(<HomeGiocatore home={home(gara)} gara={offline} />);
    expect(screen.getByTestId("home-posizione-girone")).toHaveTextContent(
      /1ª\s+pari merito/,
    );
    const generale = screen.getByTestId("home-posizione-generale");
    expect(generale).toHaveTextContent("4ª");
    expect(generale).toHaveTextContent("20 punti");
    expect(generale).toHaveTextContent("provvisori");
  });

  test("mostra il mio girone con la riga «Tu» a testo", () => {
    render(<HomeGiocatore home={home(gara)} gara={offline} />);
    const tabella = screen.getByTestId("live-mio-girone");
    const mia = tabella.querySelector("[data-mia=true]");
    expect(mia).toHaveTextContent("Rossi Luca");
    expect(mia).toHaveTextContent("Tu");
  });

  test("a partite finite mostra l'ultima giocata", () => {
    render(<HomeGiocatore home={home(garaFinita)} gara={offline} />);
    expect(
      screen.getByRole("heading", { name: "La tua ultima partita" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hai giocato tutte le tue partite del girone."),
    ).toBeInTheDocument();
  });

  test("senza partite né classifica lo dice a testo", () => {
    render(<HomeGiocatore home={home(garaVuota)} gara={offline} />);
    expect(screen.getByText(/Non hai ancora partite/)).toBeInTheDocument();
    expect(screen.getAllByText("Non ancora in classifica")).toHaveLength(2);
    expect(screen.queryByTestId("live-mio-girone")).not.toBeInTheDocument();
  });
});

describe("w-home negli altri giorni", () => {
  test("mostra la prossima tappa con le iscrizioni aperte, senza barra Live", () => {
    render(<HomeGiocatore home={home(prossimaAperta)} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Ciao, Luca" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Stato degli aggiornamenti" }),
    ).not.toBeInTheDocument();
    const card = screen.getByTestId("home-prossima");
    expect(card).toHaveTextContent("Tappa 2 · Rimini");
    expect(card).toHaveTextContent("Iscrizioni aperte");
    expect(card).toHaveTextContent("5 liberi su 16");
    expect(
      within(card).getByRole("link", { name: "Iscriviti alla tappa" }),
    ).toHaveAttribute("href", "/tappe/rimini");
  });

  test("se sono iscritto lo dice a testo, con il posto", () => {
    render(<HomeGiocatore home={home(prossimaIscritto)} />);
    const card = screen.getByTestId("home-prossima");
    expect(
      within(card).getByRole("heading", { name: "La tua prossima tappa" }),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent("Sei iscritto · posto 7");
    expect(
      within(card).queryByRole("link", { name: "Iscriviti alla tappa" }),
    ).not.toBeInTheDocument();
  });

  test("con le iscrizioni chiuse non propone di iscriversi", () => {
    render(<HomeGiocatore home={home(prossimaChiusa)} />);
    expect(screen.getByTestId("home-prossima")).toHaveTextContent(
      "Iscrizioni chiuse",
    );
    expect(
      screen.getByRole("link", { name: "Dettagli della tappa" }),
    ).toHaveAttribute("href", "/tappe/cagliari");
  });

  test("senza tappe in arrivo mostra lo stato vuoto", () => {
    render(<HomeGiocatore home={home({ tipo: "vuota" })} />);
    expect(
      screen.getByRole("heading", { name: "Nessuna tappa in programma" }),
    ).toBeInTheDocument();
  });

  test("a sessione scaduta invita ad accedere di nuovo", () => {
    render(<HomeGiocatore home={{ status: "sessionExpired" }} />);
    expect(
      screen.getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute("href", "/sessione-scaduta");
  });
});
