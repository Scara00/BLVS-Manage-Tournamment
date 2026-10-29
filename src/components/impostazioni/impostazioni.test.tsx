import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GIOCATORE_ANONIMO } from "@/lib/cancellazione/anonimo";
import {
  IMPOSTAZIONI_MESSAGES,
  type CancellazioneAction,
} from "@/lib/impostazioni/types";
import { AccountCancellato } from "./account-cancellato";
import { EliminaAccount } from "./elimina-account";
import { impostazioniLuca, rigaLuca } from "./fixtures";
import { ImpostazioniView } from "./impostazioni-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const cambia = vi.fn(async () => ({ status: "idle" as const }));

describe("ImpostazioniView", () => {
  it("tre sezioni: password, consenso con la riga pubblica, cancellazione", () => {
    render(
      <ImpostazioniView
        impostazioni={impostazioniLuca}
        cambiaPassword={cambia}
      />,
    );
    for (const name of [
      "Password",
      "Consenso e dati pubblici",
      "Cancella l'account",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/Password attuale/)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("27 ottobre 2026")).toBeInTheDocument();

    const riga = screen.getByRole("table", {
      name: "Classifica generale maschile · Stagione 2026",
    });
    expect(within(riga).getByText("Luca Rossi")).toBeInTheDocument();
    expect(within(riga).getByText("sei tu")).toBeInTheDocument();
    expect(within(riga).getByText("28")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Cancella l'account…" }),
    ).toHaveAttribute("href", "/impostazioni/elimina-account");
  });

  it("errori accanto ai campi della password", () => {
    render(
      <ImpostazioniView
        impostazioni={impostazioniLuca}
        cambiaPassword={cambia}
        statoPassword={{
          status: "error",
          message: IMPOSTAZIONI_MESSAGES.invalid,
          fields: { attuale: IMPOSTAZIONI_MESSAGES.attualeErrata },
        }}
      />,
    );
    expect(
      screen.getByLabelText(/Password attuale/),
    ).toHaveAccessibleDescription(
      expect.stringContaining(IMPOSTAZIONI_MESSAGES.attualeErrata),
    );
  });
});

describe("EliminaAccount", () => {
  it("mostra la riga che sparisce e dice che la classifica si ricalcola", () => {
    render(<EliminaAccount riga={rigaLuca} action={vi.fn()} />);
    expect(
      document.querySelectorAll("[data-slot=riga-pubblica] tbody tr"),
    ).toHaveLength(1);
    // Table and card (below md) both carry the row.
    expect(screen.getAllByText("Luca Rossi")).toHaveLength(2);
    expect(
      screen.getByText(/questa riga sparisce e la classifica si ricalcola/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cosa cambia per gli altri" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(GIOCATORE_ANONIMO)).not.toBeInTheDocument();
  });

  it("senza ELIMINA l'errore è accanto al campo e il dialogo non si apre", async () => {
    const user = userEvent.setup();
    const action = vi.fn<CancellazioneAction>();
    render(<EliminaAccount riga={rigaLuca} action={action} />);
    await user.click(
      screen.getByRole("button", { name: "Cancella l'account" }),
    );
    const campo = screen.getByLabelText(/Scrivi ELIMINA/);
    expect(campo).toHaveAccessibleDescription(
      expect.stringContaining(IMPOSTAZIONI_MESSAGES.confermaMancante),
    );
    await waitFor(() => expect(campo).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("con ELIMINA chiede conferma e solo «Sì» chiama l'azione", async () => {
    const user = userEvent.setup();
    const action = vi.fn<CancellazioneAction>(() => new Promise(() => {}));
    render(<EliminaAccount riga={rigaLuca} action={action} />);
    await user.type(screen.getByLabelText(/Scrivi ELIMINA/), "elimina{Enter}");
    const dialogo = await screen.findByRole("alertdialog");
    expect(action).not.toHaveBeenCalled();
    await user.click(
      within(dialogo).getByRole("button", { name: "Sì, cancella l'account" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("conferma")).toBe("elimina");
  });
});

describe("AccountCancellato", () => {
  it("dice «Account cancellato»", () => {
    render(<AccountCancellato />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Account cancellato" }),
    ).toBeInTheDocument();
  });
});
