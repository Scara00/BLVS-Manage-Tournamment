import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profilo, ProfiloFormState } from "@/lib/profilo/types";
import { ProfiloForm, haModifiche } from "./profilo-form";
import { ProfiloView } from "./profilo-view";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const profilo: Profilo = {
  nome: "Marco",
  cognome: "Rossi",
  email: "marco@example.it",
  emailConfermata: true,
  emailInAttesa: null,
  categoria: "M",
  statoCategoria: "modificabile",
};

beforeEach(() => {
  router.push.mockReset();
});

describe("ProfiloView", () => {
  it("mostra i dati con i badge a testo", () => {
    render(
      <ProfiloView profilo={{ ...profilo, statoCategoria: "bloccata" }} />,
    );
    expect(screen.getByText("marco@example.it")).toBeInTheDocument();
    expect(screen.getByText("Email confermata")).toBeInTheDocument();
    expect(screen.getByText("Categoria bloccata")).toBeInTheDocument();
    expect(screen.getByText("Maschile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modifica dati" })).toHaveAttribute(
      "href",
      "/profilo/modifica",
    );
  });

  it("segnala un'email non confermata e il cambio in attesa", () => {
    render(
      <ProfiloView
        profilo={{
          ...profilo,
          emailConfermata: false,
          emailInAttesa: "nuova@example.it",
        }}
      />,
    );
    expect(screen.getByText("Email da confermare")).toBeInTheDocument();
    expect(
      screen.getByText("Cambio in attesa di conferma"),
    ).toBeInTheDocument();
    expect(screen.getByText("nuova@example.it")).toBeInTheDocument();
  });
});

describe("ProfiloForm", () => {
  it("collega gli errori del server ai campi e porta il focus al primo", async () => {
    const state: ProfiloFormState = {
      status: "error",
      message: "Controlla i campi evidenziati.",
      fields: { email: "Questa email è già usata da un altro account." },
    };
    const action = vi.fn(async () => state);
    render(<ProfiloForm profilo={profilo} action={action} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Salva modifiche" }),
    );

    const email = screen.getByRole("textbox", { name: /Email/ });
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      /Errore: Questa email è già usata/,
    );
    expect(action).toHaveBeenCalledOnce();
  });

  it("a categoria bloccata mostra una riga di sola lettura, senza controlli", () => {
    render(
      <ProfiloForm
        profilo={{ ...profilo, statoCategoria: "bloccata" }}
        action={vi.fn()}
      />,
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Categoria" });
    expect(group).toHaveAccessibleDescription(/Hai già giocato una tappa/);
    expect(within(group).getByText("Categoria bloccata")).toBeInTheDocument();
  });

  it("prima della prima tappa la categoria si sceglie con le schede", () => {
    render(<ProfiloForm profilo={profilo} action={vi.fn()} />);
    const group = screen.getByRole("radiogroup", { name: /Categoria/ });
    expect(
      within(group).getByRole("radio", { name: "Maschile" }),
    ).toBeChecked();
  });

  it("mostra il messaggio di sessione scaduta con il link per accedere", () => {
    render(
      <ProfiloForm
        profilo={profilo}
        action={vi.fn()}
        initialState={{
          status: "sessionExpired",
          message: "Sessione scaduta.",
        }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sessione scaduta.");
    expect(
      within(alert).getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute("href", "/sessione-scaduta?da=%2Fprofilo%2Fmodifica");
  });

  it("con modifiche non salvate chiede conferma prima di uscire", async () => {
    const user = userEvent.setup();
    render(<ProfiloForm profilo={profilo} action={vi.fn()} />);

    // No changes: the link just navigates.
    expect(
      screen.getByRole("link", { name: "Torna al profilo" }),
    ).toBeVisible();

    await user.clear(screen.getByRole("textbox", { name: /Nome/ }));
    await user.type(screen.getByRole("textbox", { name: /Nome/ }), "Marcello");
    await user.click(screen.getByRole("link", { name: "Annulla" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Uscire senza salvare?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Resta sulla pagina" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /Nome/ })).toHaveValue(
      "Marcello",
    );

    await user.click(screen.getByRole("link", { name: "Annulla" }));
    await user.click(
      await screen.findByRole("button", { name: "Esci senza salvare" }),
    );
    expect(router.push).toHaveBeenCalledWith("/profilo");
  });

  it("dopo il salvataggio i valori inviati sono la nuova base", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ProfiloFormState> => ({
      status: "success",
      message: "Dati salvati.",
      values: { ...profilo, nome: "Marcello" },
      emailInAttesa: null,
    }));
    render(<ProfiloForm profilo={profilo} action={action} />);

    await user.clear(screen.getByRole("textbox", { name: /Nome/ }));
    await user.type(screen.getByRole("textbox", { name: /Nome/ }), "Marcello");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Dati salvati.",
    );
    expect(
      screen.getByRole("link", { name: "Torna al profilo" }),
    ).toBeVisible();
  });
});

describe("haModifiche", () => {
  const base = {
    nome: "Marco",
    cognome: "Rossi",
    email: "marco@example.it",
    categoria: "M" as const,
  };

  it("ignora spazi ai bordi e maiuscole nell'email", () => {
    expect(
      haModifiche(
        { ...base, nome: " Marco ", email: "Marco@Example.it" },
        base,
      ),
    ).toBe(false);
  });

  it("rileva un cambio di categoria", () => {
    expect(haModifiche({ ...base, categoria: "F" }, base)).toBe(true);
  });
});
