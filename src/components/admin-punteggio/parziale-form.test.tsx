import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SalvaParzialeAction } from "@/lib/punteggi/parziale";
import { ParzialeForm } from "./parziale-form";
import {
  inCorso,
  inviaParzialeConflitto,
  inviaParzialeFinto,
} from "./stories-data";

const campo = (nome: RegExp) => screen.getByRole("textbox", { name: nome });

describe("ParzialeForm (BLVS-37)", () => {
  it("parte dall'ultimo parziale inviato e dice che non entra in classifica", () => {
    render(<ParzialeForm scheda={inCorso} invia={inviaParzialeFinto} />);
    expect(campo(/Parziale di Rinaldi\/Conti/)).toHaveValue("14");
    expect(campo(/Parziale di Moretti\/Gallo/)).toHaveValue("11");
    expect(screen.getByTestId("parziale-attuale")).toHaveTextContent(
      "Ultimo inviato: 14–11",
    );
    expect(screen.getByTestId("parziale-form")).toHaveTextContent(
      "Il parziale non entra in classifica.",
    );
  });

  it("invia con la versione letta, conferma a testo e lascia il focus sul pulsante", async () => {
    const user = userEvent.setup();
    const invia = vi.fn(inviaParzialeFinto) as unknown as SalvaParzialeAction &
      ReturnType<typeof vi.fn>;
    render(<ParzialeForm scheda={inCorso} invia={invia} />);
    await user.click(
      screen.getByRole("button", {
        name: "Aggiungi un punto al parziale di Rinaldi/Conti",
      }),
    );
    const bottone = screen.getByRole("button", { name: /Invia parziale/ });
    await user.click(bottone);
    const data = invia.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data)).toMatchObject({
      puntiA: "15",
      puntiB: "11",
      versione: "3",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Parziale inviato ai giocatori: Rinaldi/Conti 15 – 11 Moretti/Gallo. Il parziale non entra in classifica.",
    );
    expect(document.activeElement).toBe(bottone);

    // The next send is based on the version this admin just wrote.
    await user.click(bottone);
    expect(
      Object.fromEntries(invia.mock.calls[1][1] as FormData),
    ).toMatchObject({ versione: "4" });
  });

  it("valori non validi: errore sul campo, niente invio", async () => {
    const user = userEvent.setup();
    const invia = vi.fn(inviaParzialeFinto);
    render(<ParzialeForm scheda={inCorso} invia={invia} />);
    await user.clear(campo(/Parziale di Rinaldi\/Conti/));
    await user.type(campo(/Parziale di Rinaldi\/Conti/), "1.5");
    await user.click(screen.getByRole("button", { name: /Invia parziale/ }));
    expect(invia).not.toHaveBeenCalled();
    expect(campo(/Parziale di Rinaldi\/Conti/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("offline: il pulsante resta disattivo e lo dice", () => {
    render(
      <ParzialeForm scheda={inCorso} invia={inviaParzialeFinto} offline />,
    );
    expect(
      screen.getByRole("button", { name: /Invia parziale/ }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Sei offline/)).toBeInTheDocument();
  });

  it("conflitto: dialogo con i due parziali; «Tieni quello inviato» riprende valore e versione", async () => {
    const user = userEvent.setup();
    render(<ParzialeForm scheda={inCorso} invia={inviaParzialeConflitto} />);
    await user.click(screen.getByRole("button", { name: /Invia parziale/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Il parziale è cambiato" }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Giulia Neri");
    await user.click(
      within(dialog).getByRole("button", { name: "Tieni quello inviato" }),
    );
    await waitFor(() =>
      expect(campo(/Parziale di Rinaldi\/Conti/)).toHaveValue("15"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Hai tenuto il parziale già inviato",
    );
  });
});
