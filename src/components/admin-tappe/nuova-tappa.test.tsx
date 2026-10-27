import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import {
  NUOVA_TAPPA_MESSAGES as M,
  type NuovaTappaAction,
  type NuovaTappaFormState,
} from "@/lib/tappe/nuova/types";
import { NuovaTappaForm } from "./nuova-tappa-form";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderForm(
  action: NuovaTappaAction = async () => ({ status: "idle" }),
  initialState?: NuovaTappaFormState,
) {
  return render(
    <ToastProvider>
      <NuovaTappaForm action={action} initialState={initialState} />
      <Toaster />
    </ToastProvider>,
  );
}

const postiM = () =>
  screen.getByRole("spinbutton", { name: /tabellone maschile/ });
const postiF = () =>
  screen.getByRole("spinbutton", { name: /tabellone femminile/ });

beforeEach(() => {
  router.replace.mockReset();
  localStorage.clear();
});

describe("NuovaTappaForm", () => {
  it("mostra i campi richiesti e due tabelloni indipendenti", () => {
    renderForm();
    for (const name of [/^Nome/, /^Luogo/, /^Data/, /^Scadenza/]) {
      expect(screen.getByLabelText(name)).toBeRequired();
    }
    expect(postiM()).toHaveValue(16);
    expect(postiF()).toHaveValue(16);
    expect(screen.getByLabelText(/^Scadenza/)).toHaveAccessibleDescription(
      /Europe\/Rome/,
    );
  });

  it("mette gli errori accanto ai campi e porta il focus al primo", async () => {
    renderForm(undefined, {
      status: "error",
      message: M.invalid,
      fields: { luogo: "Campo obbligatorio.", scadenza: M.scadenzaDopoTappa },
    });
    const luogo = screen.getByLabelText(/^Luogo/);
    await waitFor(() => expect(luogo).toHaveFocus());
    expect(luogo).toHaveAttribute("aria-invalid", "true");
    expect(luogo).toHaveAccessibleDescription(/Campo obbligatorio/);
    expect(screen.getByLabelText(/^Scadenza/)).toHaveAccessibleDescription(
      new RegExp(M.scadenzaDopoTappa),
    );
    expect(screen.getByLabelText(/^Nome/)).not.toHaveAttribute("aria-invalid");
  });

  it("invia i valori e, se il server rifiuta, li conserva", async () => {
    const user = userEvent.setup();
    const action = vi.fn<NuovaTappaAction>(async () => ({
      status: "error",
      message: M.invalid,
      fields: { nome: "Campo obbligatorio." },
    }));
    renderForm(action);
    await user.type(screen.getByLabelText(/^Luogo/), "Lignano");
    await user.click(
      screen.getByRole("button", { name: "Crea tappa in bozza" }),
    );
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).toHaveFocus());
    const data = action.mock.calls[0][1];
    expect(data.get("luogo")).toBe("Lignano");
    expect(data.get("postiM")).toBe("16");
    expect(screen.getByLabelText(/^Luogo/)).toHaveValue("Lignano");
  });

  it("avvisa una volta accanto al campo se i gironi non sono completi", async () => {
    const user = userEvent.setup();
    renderForm();
    const campo = postiM();
    await user.clear(campo);
    await user.type(campo, "20");
    // Nothing while typing: the check runs when the value is committed.
    expect(screen.queryByText(/non sono completi/)).not.toBeInTheDocument();
    await user.tab();

    const avvisi = screen.getAllByText(/non sono completi/);
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0]).toHaveTextContent(
      "Tabellone maschile: con 20 iscritti i gironi da 4 non sono completi in tutte le fasi.",
    );
    expect(avvisi[0].closest("[role=status]")).not.toBeNull();
    expect(campo).toHaveAccessibleDescription(/non sono completi/);
    // The other board is independent.
    expect(postiF()).not.toHaveAccessibleDescription(/non sono completi/);

    await user.click(screen.getByRole("button", { name: "Usa 32" }));
    expect(campo).toHaveValue(32);
    expect(campo).toHaveFocus();
    expect(screen.queryByText(/non sono completi/)).not.toBeInTheDocument();
  });

  it("non avvisa per i valori fuori intervallo (sono errori)", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(postiF());
    await user.type(postiF(), "2");
    await user.tab();
    expect(screen.queryByText(/non sono completi/)).not.toBeInTheDocument();
  });

  it("dopo il salvataggio conferma e torna alla dashboard", async () => {
    const user = userEvent.setup();
    renderForm(async () => ({
      status: "success",
      message: M.created,
      id: "t1",
      href: "/admin",
    }));
    await user.click(
      screen.getByRole("button", { name: "Crea tappa in bozza" }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin"));
    expect(await screen.findByText(M.created)).toBeInTheDocument();
  });

  it("a sessione scaduta propone di accedere di nuovo", () => {
    renderForm(undefined, {
      status: "sessionExpired",
      message: M.sessionExpired,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(M.sessionExpired);
    expect(
      screen.getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute("href", "/sessione-scaduta?da=%2Fadmin%2Ftappe%2Fnuova");
  });
});
