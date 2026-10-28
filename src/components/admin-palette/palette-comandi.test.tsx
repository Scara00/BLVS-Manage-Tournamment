import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CercaPaletteAction } from "@/lib/admin/palette/types";
import { PaletteComandi } from "./palette-comandi";
import { esitoJesolo } from "./stories-data";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderPalette(cerca?: CercaPaletteAction) {
  const action = vi.fn<CercaPaletteAction>(cerca ?? (async () => esitoJesolo));
  render(
    <>
      <button type="button">Prima</button>
      <PaletteComandi cerca={action} />
    </>,
  );
  return action;
}

const campo = () => screen.getByRole("combobox", { name: /Cerca tappe/ });

beforeEach(() => router.push.mockReset());

describe("PaletteComandi", () => {
  it("Ctrl+K apre la palette con il focus nel campo; Esc chiude e riporta il focus", async () => {
    const user = userEvent.setup();
    renderPalette();
    const prima = screen.getByRole("button", { name: "Prima" });
    prima.focus();

    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(campo()).toHaveFocus());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(prima).toHaveFocus());
  });

  it("Cmd+K apre la palette anche su macOS", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Meta>}k{/Meta}");
    await waitFor(() => expect(campo()).toHaveFocus());
  });

  it("il pulsante «Cerca» apre la palette (touch) e dichiara la scorciatoia", async () => {
    const user = userEvent.setup();
    renderPalette();
    const apri = screen.getByRole("button", { name: /^Cerca/ });
    expect(apri).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    await user.click(apri);
    await waitFor(() => expect(campo()).toHaveFocus());
  });

  it("senza testo propone i comandi", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Control>}k{/Control}");
    const comandi = await screen.findByRole("group", { name: "Comandi" });
    expect(comandi).toContainElement(
      screen.getByRole("option", { name: /Nuova tappa/ }),
    );
    expect(campo()).toHaveAttribute("aria-expanded", "true");
  });

  it("ricerca: gruppi tappe, giocatori e partite e conteggio annunciato", async () => {
    const user = userEvent.setup();
    const cerca = renderPalette();
    await user.keyboard("{Control>}k{/Control}");
    await user.type(campo(), "jesolo");

    await waitFor(() => expect(cerca).toHaveBeenCalledWith("jesolo"));
    expect(cerca).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("group", { name: "Tappe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Giocatori" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Partite" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 risultati per «jesolo».",
    );
  });

  it("frecce e Invio: aria-activedescendant segue l'opzione e Invio la apre", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Control>}k{/Control}");
    await user.type(campo(), "jesolo");
    await screen.findByRole("group", { name: "Tappe" });

    await user.keyboard("{ArrowDown}");
    const tappa = screen.getByRole("option", { name: /^Tappa 1 · Jesolo/ });
    expect(campo()).toHaveAttribute("aria-activedescendant", tappa.id);
    expect(tappa).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    const giocatore = screen.getByRole("option", { name: /Rossi Luca/ });
    expect(campo()).toHaveAttribute("aria-activedescendant", giocatore.id);

    await user.keyboard("{ArrowUp}{ArrowUp}");
    // Wraps around to the last option.
    expect(campo().getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: /Rossi e Bianchi/ }).id,
    );

    await user.keyboard("{Home}{Enter}");
    expect(router.push).toHaveBeenCalledWith("/admin/tappe/jesolo");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Invio senza opzione attiva non apre nulla", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Control>}k{/Control}");
    await user.type(campo(), "jesolo{Enter}");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("un tocco su un'opzione la apre", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Control>}k{/Control}");
    await user.click(
      await screen.findByRole("option", { name: /Nuova tappa/ }),
    );
    expect(router.push).toHaveBeenCalledWith("/admin/tappe/nuova");
  });

  it("stato di caricamento, poi vuoto", async () => {
    const user = userEvent.setup();
    let risolvi: (() => void) | undefined;
    renderPalette(
      () =>
        new Promise((resolve) => {
          risolvi = () =>
            resolve({ status: "ok", tappe: [], giocatori: [], partite: [] });
        }),
    );
    await user.keyboard("{Control>}k{/Control}");
    await user.type(campo(), "zzzz");
    expect(screen.getByRole("status")).toHaveTextContent("Ricerca in corso…");

    await waitFor(() => expect(risolvi).toBeDefined());
    await act(async () => risolvi?.());
    expect(await screen.findByTestId("palette-vuota")).toHaveTextContent(
      "Nessun risultato per «zzzz»",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nessun risultato per «zzzz».",
    );
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(campo()).not.toHaveAttribute("aria-controls");
  });

  it("una risposta lenta non sovrascrive la ricerca più recente", async () => {
    const user = userEvent.setup();
    const risposte = new Map<string, () => void>();
    renderPalette(
      (q) =>
        new Promise((resolve) => {
          risposte.set(q, () =>
            resolve(
              q === "jes"
                ? esitoJesolo
                : { status: "ok", tappe: [], giocatori: [], partite: [] },
            ),
          );
        }),
    );
    await user.keyboard("{Control>}k{/Control}");
    await user.type(campo(), "jes");
    await waitFor(() => expect(risposte.has("jes")).toBe(true));
    await user.type(campo(), "xx");
    await waitFor(() => expect(risposte.has("jesxx")).toBe(true));
    await act(async () => risposte.get("jesxx")?.());
    await act(async () => risposte.get("jes")?.());
    expect(screen.getByTestId("palette-vuota")).toBeInTheDocument();
  });

  it("un errore della ricerca è mostrato come avviso", async () => {
    const user = userEvent.setup();
    renderPalette(async () => {
      throw new Error("offline");
    });
    await user.keyboard("{Control>}k{/Control}");
    await user.type(campo(), "jesolo");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ricerca non riuscita",
    );
  });
});
