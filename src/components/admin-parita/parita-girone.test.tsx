import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RisolviParitaAction } from "@/lib/gironi/parita/types";
import { ParitaGirone } from "./parita-girone";
import { paritaTreDemo } from "./stories-data";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/tappe/jesolo/live/m",
  useRouter: () => ({ refresh: vi.fn() }),
}));

const MESSAGGIO =
  "Girone A: ordine deciso. 2º Paolo Marino, 3º Marco Bianchi, 4º Andrea Greco.";

function renderParita(action: RisolviParitaAction) {
  return render(<ParitaGirone girone={paritaTreDemo()} risolvi={action} />);
}

const successo = () =>
  vi.fn<RisolviParitaAction>(async () => ({
    status: "success",
    message: MESSAGGIO,
    firma: "f",
    at: 1,
  }));

describe("ParitaGirone (w-admin-parita)", () => {
  it("mostra i giocatori pari in ogni criterio", async () => {
    const user = userEvent.setup();
    renderParita(successo());
    expect(screen.getByText("Parità da risolvere")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Risolvi la parità del Girone A" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(screen.getAllByTestId("criterio-pari")).toHaveLength(4);
    const vittorie = within(dialog).getByRole("list", {
      name: "Vittorie dei giocatori pari",
    });
    expect(within(vittorie).getAllByRole("listitem")).toHaveLength(3);
    expect(within(dialog).getAllByText("−2")).toHaveLength(3);
  });

  it("«Scambia ↕» scambia due vicini e lo annuncia", async () => {
    const user = userEvent.setup();
    renderParita(successo());
    await user.click(screen.getByRole("button", { name: /Risolvi la parità/ }));
    await user.click(
      await screen.findByRole("button", {
        name: "Scambia Marco Bianchi e Paolo Marino",
      }),
    );
    const ordine = within(screen.getByTestId("ordine-parita"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(ordine[0]).toContain("2ºPaolo Marino");
    expect(ordine[1]).toContain("3ºMarco Bianchi");
    expect(screen.getByTestId("annuncio-scambio")).toHaveTextContent(
      "Ordine: 2º Paolo Marino, 3º Marco Bianchi, 4º Andrea Greco.",
    );
  });

  it("senza motivo non chiede conferma e porta il fuoco sull'errore", async () => {
    const user = userEvent.setup();
    const action = successo();
    renderParita(action);
    await user.click(screen.getByRole("button", { name: /Risolvi la parità/ }));
    await user.click(
      await screen.findByRole("button", { name: "Conferma l'ordine" }),
    );
    expect(
      await screen.findByText("Scegli come è stata decisa la parità."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Sorteggio" })).toHaveFocus(),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("decide l'ordine solo dopo la conferma separata e annuncia il risultato", async () => {
    const user = userEvent.setup();
    const action = successo();
    renderParita(action);
    await user.click(screen.getByRole("button", { name: /Risolvi la parità/ }));
    await user.click(
      await screen.findByRole("button", {
        name: "Scambia Marco Bianchi e Paolo Marino",
      }),
    );
    await user.click(screen.getByRole("radio", { name: "Sorteggio" }));
    await user.type(screen.getByLabelText(/Dettagli/), "monetina");
    await user.click(screen.getByRole("button", { name: "Conferma l'ordine" }));

    const conferma = await screen.findByRole("alertdialog");
    expect(conferma).toHaveTextContent("Decidere questo ordine?");
    expect(
      within(conferma).getByRole("list", { name: "Nuovo ordine" }),
    ).toHaveTextContent("2ºPaolo Marino3ºMarco Bianchi4ºAndrea Greco");
    expect(action).not.toHaveBeenCalled();

    await user.click(
      within(conferma).getByRole("button", { name: "Sì, decidi l'ordine" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.getAll("ordine")).toEqual([
      "demo-M-i3",
      "demo-M-i2",
      "demo-M-i4",
    ]);
    expect(data.get("motivo")).toBe("sorteggio");
    expect(data.get("note")).toBe("monetina");
    const esito = await screen.findByTestId("parita-esito");
    expect(esito).toHaveTextContent(MESSAGGIO);
    await waitFor(() => expect(esito).toHaveFocus());
  });

  it("una parità decisa si riapre con il motivo precedente", async () => {
    const user = userEvent.setup();
    render(
      <ParitaGirone
        girone={paritaTreDemo({
          ordine: ["demo-M-i4", "demo-M-i2", "demo-M-i3"],
          motivo: "Sorteggio: monetina",
        })}
        risolvi={successo()}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Modifica la decisione del Girone A",
      }),
    );
    await screen.findByRole("dialog");
    expect(screen.getByRole("radio", { name: "Sorteggio" })).toBeChecked();
    expect(screen.getByLabelText(/Dettagli/)).toHaveValue("monetina");
    expect(
      within(screen.getByTestId("ordine-parita")).getAllByRole("listitem")[0],
    ).toHaveTextContent("Andrea Greco");
  });
});
