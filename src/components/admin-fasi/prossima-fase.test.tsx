import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProssimaFaseAction } from "@/lib/gironi/fasi/types";
import { ProssimaFase } from "./prossima-fase";
import {
  finaliGenerate,
  finaliPronte,
  propostaIncompleta,
  propostaParita,
  propostaPronta,
  propostaSalvata,
} from "./stories-data";

describe("ProssimaFase (proposta gold/silver e finali)", () => {
  it("propone gold con 1° e 2° e silver con 3° e 4°, con la provenienza", () => {
    render(<ProssimaFase view={propostaPronta} action={vi.fn()} />);
    expect(screen.getByTestId("fase-tabellone")).toHaveTextContent(
      "Gironi iniziali",
    );
    const gironi = within(
      screen.getByRole("list", { name: "Gironi proposti" }),
    ).getAllByTestId("girone-proposto");
    expect(gironi.map((g) => g.dataset.fase)).toEqual([
      "gold",
      "gold",
      "silver",
      "silver",
    ]);
    expect(gironi[0]).toHaveTextContent("Gold A");
    expect(gironi[0]).toHaveTextContent("1° Girone A");
    expect(gironi[0]).toHaveTextContent("2° Girone C");
    expect(gironi[2]).toHaveTextContent("3° Girone A");
  });

  it("con una parità blocca la proposta e porta a «Risolvi parità»", () => {
    render(<ProssimaFase view={propostaParita} action={vi.fn()} />);
    expect(screen.getByTestId("parita-da-risolvere")).toHaveTextContent(
      "C'è una parità da risolvere",
    );
    expect(
      screen.getByRole("link", { name: "Risolvi parità nel Girone A" }),
    ).toHaveAttribute(
      "href",
      "/admin/tappe/jesolo/gironi/m#girone-girone-iniziale-0",
    );
    expect(
      screen.queryByRole("button", { name: "Proponi i gironi gold e silver" }),
    ).not.toBeInTheDocument();
  });

  it("avvisa dei gironi da completare nell'editor", () => {
    render(<ProssimaFase view={propostaIncompleta} action={vi.fn()} />);
    expect(screen.getByTestId("prossima-fase-avvisi")).toHaveTextContent(
      "Gold B: 2 giocatori invece di 4",
    );
  });

  it("chiede conferma e invia tappa, tabellone e tipo", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ProssimaFaseAction>(async () => ({
      status: "success",
      message: "ok",
      at: 1,
    }));
    render(<ProssimaFase view={propostaPronta} action={action} />);
    await user.click(
      screen.getByRole("button", { name: "Proponi i gironi gold e silver" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Proporre i gironi gold e silver del tabellone maschile?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Proponi" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const dati = action.mock.calls[0][1];
    expect(Object.fromEntries(dati.entries())).toEqual({
      tappaId: "jesolo",
      categoria: "m",
      tipo: "gold_silver",
    });
  });

  it("mostra la fase salvata, le finali pronte e quelle generate", () => {
    const { rerender } = render(
      <ProssimaFase view={propostaSalvata} action={vi.fn()} />,
    );
    expect(
      screen.getByRole("link", {
        name: "Vai all'avvio dei gironi gold e silver",
      }),
    ).toHaveAttribute("href", "/admin/tappe/jesolo/avvio/m");

    rerender(<ProssimaFase view={finaliPronte} action={vi.fn()} />);
    expect(screen.getByTestId("fase-tabellone")).toHaveTextContent(
      "Gironi gold e silver",
    );
    const finali = screen.getAllByTestId("girone-proposto");
    expect(finali.map((g) => g.dataset.fase)).toEqual([
      "finale_gold",
      "finale_silver",
    ]);
    expect(
      screen.getByRole("button", { name: "Genera le finali" }),
    ).toBeInTheDocument();

    rerender(<ProssimaFase view={finaliGenerate} action={vi.fn()} />);
    expect(screen.getByTestId("fase-tabellone")).toHaveTextContent("Finali");
    expect(screen.getByTestId("prossima-fase-esito")).toHaveTextContent(
      "Finali generate",
    );
  });

  it("annuncia l'errore del server", () => {
    render(
      <ProssimaFase
        view={propostaPronta}
        action={vi.fn()}
        initialState={{
          status: "error",
          reason: "blocked",
          message: "Errore di prova",
          at: 1,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Errore di prova");
  });

  it("nel misto con troppi gironi fa scegliere 2 uomini + 2 donne per finale", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ProssimaFaseAction>(async () => ({
      status: "success",
      message: "ok",
      at: 1,
    }));
    const candidato = (id: string, categoria: "M" | "F") => ({
      iscrizioneId: id,
      nome: `Giocatore ${id}`,
      provenienza:
        categoria === "M" ? "Miglior uomo · Gold A" : "Miglior donna · Gold A",
      categoria,
      dettaglio: "2 vittorie · +11",
    });
    render(
      <ProssimaFase
        view={{
          ...finaliPronte,
          categoria: "X",
          stato: "manuale",
          anteprima: [],
          scelta: [
            {
              fase: "finale_gold",
              nome: "Finale gold",
              perCategoria: 2,
              candidati: [
                candidato("m1", "M"),
                candidato("m2", "M"),
                candidato("m3", "M"),
                candidato("f1", "F"),
                candidato("f2", "F"),
              ],
            },
          ],
        }}
        action={action}
      />,
    );
    // Disabled but focusable, with the reason next to it.
    const genera = () =>
      screen.getByRole("button", { name: "Genera le finali" });
    expect(genera()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Completa prima ogni finale/)).toBeInTheDocument();

    for (const nome of ["m1", "m2", "f1"]) {
      await user.click(
        screen.getByRole("checkbox", { name: `Giocatore ${nome}` }),
      );
    }
    // Due uomini scelti: il terzo non si può più spuntare.
    expect(
      screen.getByRole("checkbox", { name: "Giocatore m3" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(genera()).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("checkbox", { name: "Giocatore f2" }));
    expect(genera()).not.toHaveAttribute("aria-disabled");

    await user.click(genera());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Generare le finali del tabellone misto?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Genera" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const dati = action.mock.calls[0][1];
    expect(dati.get("manuale")).toBe("1");
    expect(dati.get("categoria")).toBe("x");
    expect(dati.getAll("finale_gold")).toEqual(["m1", "m2", "f1", "f2"]);
  });
});
