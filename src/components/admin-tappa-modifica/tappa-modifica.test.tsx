import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import type {
  TappaModifica,
  TappaModificaAction,
  TappaModificaFormState,
} from "@/lib/tappe/modifica/types";
import { TappaModificaForm } from "./tappa-modifica-form";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const tappa: TappaModifica = {
  id: "rimini",
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data: "2099-06-28",
  dataFine: "2099-06-29",
  scadenza: "2099-06-24T20:00",
  stato: "iscrizioni_aperte",
  versione: 3,
  tabelloni: {
    M: { posti: 16, iscritti: 12 },
    F: { posti: 16, iscritti: 9 },
  },
};

function renderForm(
  action: TappaModificaAction = vi.fn(),
  initialState?: TappaModificaFormState,
) {
  return render(
    <ToastProvider>
      <TappaModificaForm
        tappa={tappa}
        action={action}
        initialState={initialState}
      />
    </ToastProvider>,
  );
}

const postiM = () =>
  screen.getByRole("spinbutton", {
    name: /Massimo iscritti · tabellone maschile/,
  });

beforeEach(() => {
  router.push.mockReset();
  localStorage.clear();
});

describe("TappaModificaForm", () => {
  it("è precompilato, con i suggerimenti accanto ai campi", () => {
    renderForm();
    expect(
      screen.getByRole("textbox", { name: /Nome della tappa/ }),
    ).toHaveValue(tappa.nome);
    expect(screen.getByRole("textbox", { name: /Luogo/ })).toHaveValue(
      tappa.luogo,
    );
    expect(postiM()).toHaveValue(16);
    expect(postiM()).toHaveAccessibleDescription(
      "Iscritti attuali: 12. Il massimo va da 12 a 256.",
    );
    expect(postiM()).toHaveAttribute("min", "12");
  });

  it("blocca subito un massimo sotto gli iscritti, accanto al campo", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(postiM());
    await user.type(postiM(), "10");
    await user.tab();

    expect(postiM()).toHaveAttribute("aria-invalid", "true");
    expect(postiM()).toHaveAccessibleDescription(
      /^Errore: Il massimo non può scendere sotto 12/,
    );
    // Announced politely, since no submit happened.
    const field = postiM().closest<HTMLElement>("[data-slot=field]")!;
    expect(within(field).getByRole("status")).toHaveTextContent(
      "Errore: Il massimo non può scendere sotto 12",
    );
  });

  it("non invia il modulo e porta il focus sul massimo non valido", async () => {
    const user = userEvent.setup();
    const action = vi.fn<TappaModificaAction>();
    renderForm(action);
    await user.clear(postiM());
    await user.type(postiM(), "5");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(action).not.toHaveBeenCalled();
    await waitFor(() => expect(postiM()).toHaveFocus());
    expect(postiM()).toHaveAccessibleDescription(
      /Il massimo non può scendere sotto 12/,
    );
  });

  it("invia id e versione letta insieme ai dati", async () => {
    const user = userEvent.setup();
    const action = vi.fn<TappaModificaAction>(async () => ({
      status: "success",
      message: "Modifiche salvate.",
      tappa: { ...tappa, versione: 4 },
    }));
    renderForm(action);
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0][1];
    expect(data.get("id")).toBe("rimini");
    expect(data.get("versione")).toBe("3");
    expect(data.get("postiM")).toBe("16");
  });

  it("collega gli errori del server ai campi e porta il focus al primo", async () => {
    const user = userEvent.setup();
    const action = vi.fn<TappaModificaAction>(async () => ({
      status: "error",
      message: "Controlla i campi evidenziati.",
      fields: { postiF: "Il massimo non può scendere sotto 21" },
    }));
    renderForm(action);
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    const postiF = screen.getByRole("spinbutton", {
      name: /tabellone femminile/,
    });
    await waitFor(() => expect(postiF).toHaveFocus());
    expect(postiF).toHaveAccessibleDescription(
      /^Errore: Il massimo non può scendere sotto 21/,
    );
  });

  it("conflitto di versione: mostra i dati aggiornati e li carica a richiesta", async () => {
    const user = userEvent.setup();
    const nuova = { ...tappa, nome: "Rimini (spostata)", versione: 5 };
    renderForm(vi.fn(), {
      status: "conflict",
      message: "conflitto",
      tappa: nuova,
    });
    const alert = screen.getByRole("alert", { name: "Conflitto di versione" });
    expect(within(alert).getByText("Rimini (spostata)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salva modifiche" }),
    ).toHaveAttribute("aria-disabled", "true");

    await user.click(
      within(alert).getByRole("button", { name: "Usa i dati aggiornati" }),
    );
    expect(
      screen.getByRole("textbox", { name: /Nome della tappa/ }),
    ).toHaveValue("Rimini (spostata)");
    expect(
      screen.queryByRole("alert", { name: "Conflitto di versione" }),
    ).not.toBeInTheDocument();
  });

  it("offline: non invia e avvisa che le modifiche restano in bozza", async () => {
    const user = userEvent.setup();
    const action = vi.fn<TappaModificaAction>();
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderForm(action);
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Sei offline/);
    onLine.mockRestore();
  });

  it("propone un massimo con gironi completi e mai sotto gli iscritti", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(postiM());
    await user.type(postiM(), "18");
    const panel = screen.getByRole("region", { name: "Gironi" });
    expect(
      within(panel).getByText(/Tabellone maschile: con 18 iscritti/),
    ).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Usa 16" }));
    expect(postiM()).toHaveValue(16);
    expect(postiM()).toHaveFocus();
  });
});
