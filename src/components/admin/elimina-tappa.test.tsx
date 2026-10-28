import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { EliminaTappaAction } from "@/lib/tappe/eliminazione/state";
import { EliminaTappa } from "./elimina-tappa";

function renderElimina(
  action: EliminaTappaAction,
  props: Partial<Parameters<typeof EliminaTappa>[0]> = {},
) {
  return render(
    <ToastProvider>
      <EliminaTappa
        tappaId="t1"
        nome="Tappa 2 · Rimini"
        iscritti={26}
        conRisultati
        action={action}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
}

async function apri(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", {
    name: "Elimina tappa: Tappa 2 · Rimini",
  });
  trigger.focus();
  await user.keyboard("{Enter}");
  const dialog = await screen.findByRole("alertdialog", {
    name: "Eliminare «Tappa 2 · Rimini»?",
  });
  return { trigger, dialog };
}

describe("EliminaTappa", () => {
  it("si apre da tastiera con il focus su «Non eliminare» e dice cosa si perde", async () => {
    const user = userEvent.setup();
    const action = vi.fn<EliminaTappaAction>();
    renderElimina(action);

    const { trigger, dialog } = await apri(user);
    expect(dialog).toHaveTextContent(
      "26 iscrizioni vengono cancellate, senza avviso agli iscritti.",
    );
    expect(dialog).toHaveTextContent(/classifica generale della stagione/);
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Non eliminare" }),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(action).not.toHaveBeenCalled();
  });

  it("una bozza senza iscritti non parla di risultati", async () => {
    const user = userEvent.setup();
    renderElimina(vi.fn<EliminaTappaAction>(), {
      iscritti: 0,
      conRisultati: false,
    });
    const { dialog } = await apri(user);
    expect(dialog).toHaveTextContent("Nessuna iscrizione da cancellare.");
    expect(dialog).not.toHaveTextContent(/classifica generale/);
  });

  it("senza ELIMINA: errore sul campo, focus lì, niente invio", async () => {
    const user = userEvent.setup();
    const action = vi.fn<EliminaTappaAction>();
    renderElimina(action);
    const { dialog } = await apri(user);

    const campo = within(dialog).getByRole("textbox", {
      name: /Scrivi ELIMINA per confermare/,
    });
    await user.type(campo, "cancella");
    await user.click(
      within(dialog).getByRole("button", { name: "Elimina tappa" }),
    );
    await waitFor(() => expect(campo).toHaveFocus());
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(/scrivi esattamente ELIMINA/);
    expect(action).not.toHaveBeenCalled();
  });

  it("conferma: invia tappa e parola, chiude e annuncia l'esito", async () => {
    const user = userEvent.setup();
    const action = vi.fn<EliminaTappaAction>(async () => ({
      status: "success",
      message: "Tappa «Tappa 2 · Rimini» eliminata.",
      at: 1,
    }));
    renderElimina(action);
    const { dialog } = await apri(user);

    await user.type(
      within(dialog).getByRole("textbox", { name: /ELIMINA/ }),
      "elimina",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Elimina tappa" }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("tappaId")).toBe("t1");
    expect(data.get("conferma")).toBe("elimina");
    expect(
      await screen.findByText("Tappa «Tappa 2 · Rimini» eliminata."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("errore di rete: la parola resta e l'errore è annunciato", async () => {
    const user = userEvent.setup();
    const action = vi.fn<EliminaTappaAction>(async () => {
      throw new Error("offline");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderElimina(action);
    const { dialog } = await apri(user);
    const campo = within(dialog).getByRole("textbox", { name: /ELIMINA/ });
    await user.type(campo, "ELIMINA");
    await user.click(
      within(dialog).getByRole("button", { name: "Elimina tappa" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /controlla la connessione/,
    );
    expect(campo).toHaveValue("ELIMINA");
  });

  it("offline: la conferma è disattivata con il motivo a testo", async () => {
    const user = userEvent.setup();
    renderElimina(vi.fn<EliminaTappaAction>(), { offline: true });
    const { dialog } = await apri(user);
    const conferma = within(dialog).getByRole("button", {
      name: "Elimina tappa",
    });
    expect(conferma).toHaveAttribute("aria-disabled", "true");
    expect(conferma).toHaveAccessibleDescription(/Sei offline/);
  });
});
