import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { composizioneDemo } from "@/lib/gironi/editor/fixtures";
import { applicaOperazione } from "@/lib/gironi/editor/operazioni";
import {
  GIRONI_EDITOR_MESSAGES as M,
  type ComposizioneGironi,
  type EditorGironi,
  type ModificaGironiAction,
} from "@/lib/gironi/editor/types";
import { GironiEditor } from "./gironi-editor";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/tappe/t1/gironi/m",
}));

function editor(
  composizione: ComposizioneGironi = composizioneDemo(),
): EditorGironi {
  return {
    tappa: { id: "t1", nome: "Tappa 1 · Jesolo" },
    categoria: "M",
    composizione,
  };
}

/** Saves like the demo store: applies the change, version + 1. */
const salvaFinto = vi.fn<ModificaGironiAction>(
  async ({ versione, operazione }) => {
    const esito = applicaOperazione(
      { ...composizioneDemo(), versione },
      operazione,
      () => "g-nuovo",
    );
    if (!esito.ok) return { status: "error", message: M.notFound };
    return {
      status: "ok",
      composizione: { ...esito.composizione, versione: versione + 1 },
    };
  },
);

function girone(nome: string) {
  return screen.getByRole("region", { name: new RegExp(`^${nome}`) });
}

function nomi(regione: HTMLElement) {
  return within(regione)
    .queryAllByTestId("giocatore-riga")
    .map((r) => r.textContent?.trim());
}

describe("GironiEditor (w-admin-gironi)", () => {
  it("mostra gironi, contatori, legenda una volta e «Sposta» per ogni giocatore", () => {
    render(<GironiEditor editor={editor()} modifica={salvaFinto} />);
    expect(screen.getAllByTestId("girone-card")).toHaveLength(4);
    expect(within(girone("Girone A")).getByText("4/4")).toBeInTheDocument();
    expect(screen.getAllByText("Legenda")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Sposta Giulia Bianchi" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("controlli-gironi")).toHaveTextContent(
      "4 giocatori per girone: superato",
    );
  });

  it("sposta da tastiera con le scorciatoie, annuncia la modifica e i controlli", async () => {
    const user = userEvent.setup();
    salvaFinto.mockClear();
    render(<GironiEditor editor={editor()} modifica={salvaFinto} />);

    screen.getByRole("button", { name: "Sposta Giulia Bianchi" }).focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", {
      name: "Sposta nel girone…",
    });
    expect(dialog).toHaveAccessibleDescription(
      "Giulia Bianchi ora è nel Girone A.",
    );

    // 2 = Girone B: it is full, so a swap with its first player is proposed.
    await user.keyboard("2");
    expect(
      within(dialog).getByRole("radio", { name: /Girone B/ }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("radio", { name: /Chiara Esposito/ }),
    ).toBeChecked();
    // X = no swap, just move.
    await user.keyboard("x");
    expect(
      within(dialog).getByRole("radio", { name: /Nessuno/ }),
    ).toBeChecked();
    await user.keyboard("{Enter}");

    expect(salvaFinto).toHaveBeenCalledWith({
      tappaId: "t1",
      categoria: "M",
      versione: 0,
      operazione: { tipo: "sposta", iscrizioneId: "i1", verso: "g2" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("annuncio-gironi")).toHaveTextContent(
        "Giulia Bianchi spostato nel Girone B. 1 controllo da rivedere: Girone A: 3 giocatori su 4. Girone B: 5 giocatori su 4.",
      ),
    );
    expect(nomi(girone("Girone B"))).toContain("Giulia Bianchi");
    expect(
      within(girone("Girone A")).getByText("Manca 1 giocatore"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("controlli-gironi")).toHaveTextContent(
      "4 giocatori per girone: da rivedere",
    );
    // Focus follows the player to its new group.
    await waitFor(() =>
      expect(
        within(girone("Girone B")).getByRole("button", {
          name: "Sposta Giulia Bianchi",
        }),
      ).toHaveFocus(),
    );
  });

  it("scambia due giocatori scegliendo il compagno con la lettera", async () => {
    const user = userEvent.setup();
    salvaFinto.mockClear();
    render(<GironiEditor editor={editor()} modifica={salvaFinto} />);

    await user.click(
      screen.getByRole("button", { name: "Sposta Giulia Bianchi" }),
    );
    await screen.findByRole("dialog", { name: "Sposta nel girone…" });
    await user.keyboard("2b");
    await user.keyboard("{Enter}");

    expect(salvaFinto).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operazione: { tipo: "scambia", a: "i1", b: "i6" },
      }),
    );
    await waitFor(() =>
      expect(nomi(girone("Girone A"))).toEqual([
        "Matteo Romano",
        "Marco Rossi",
        "Sara Colombo",
        "Luca Ferrari",
      ]),
    );
    expect(screen.getByTestId("annuncio-gironi")).toHaveTextContent(
      /Scambiati Giulia Bianchi e Matteo Romano.*Tutti i controlli superati\./,
    );
  });

  it("aggiunge un girone e ci porta il focus", async () => {
    const user = userEvent.setup();
    render(<GironiEditor editor={editor()} modifica={salvaFinto} />);
    await user.click(screen.getByRole("button", { name: "Aggiungi girone" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Girone E" })).toHaveFocus(),
    );
    expect(screen.getByTestId("annuncio-gironi")).toHaveTextContent(
      "Girone E aggiunto. 1 controllo da rivedere: Girone E: 0 giocatori su 4.",
    );
  });

  it("elimina un girone dopo la conferma: i giocatori diventano non assegnati", async () => {
    const user = userEvent.setup();
    render(<GironiEditor editor={editor()} modifica={salvaFinto} />);
    await user.click(screen.getByRole("button", { name: "Elimina Girone D" }));
    const conferma = await screen.findByRole("alertdialog", {
      name: "Eliminare il Girone D?",
    });
    await user.click(
      within(conferma).getByRole("button", { name: "Elimina Girone D" }),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("girone-card")).toHaveLength(3),
    );
    expect(nomi(screen.getByTestId("non-assegnati"))).toHaveLength(4);
  });

  it("con un conflitto mostra i gironi aggiornati e lo dice", async () => {
    const user = userEvent.setup();
    const aggiornata = { ...composizioneDemo({ giocatori: 12 }), versione: 7 };
    const conflitto = vi.fn<ModificaGironiAction>(async () => ({
      status: "conflict",
      message: M.conflict,
      composizione: aggiornata,
    }));
    render(<GironiEditor editor={editor()} modifica={conflitto} />);
    await user.click(screen.getByRole("button", { name: "Aggiungi girone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(M.conflict);
    expect(screen.getAllByTestId("girone-card")).toHaveLength(3);
  });

  it("offline non salva e lo dice", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ModificaGironiAction>();
    render(<GironiEditor editor={editor()} modifica={action} offline />);
    await user.click(screen.getByRole("button", { name: "Aggiungi girone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(M.offline);
    expect(action).not.toHaveBeenCalled();
  });

  it("con le partite iniziate è in sola lettura", () => {
    render(
      <GironiEditor
        editor={editor(composizioneDemo({ bloccata: true }))}
        modifica={salvaFinto}
      />,
    );
    expect(screen.getByTestId("gironi-bloccati")).toHaveTextContent(M.bloccata);
    expect(screen.queryByRole("button", { name: /^Sposta/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Aggiungi girone" }),
    ).toBeNull();
  });
});
