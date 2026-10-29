import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type {
  AnnullaTappaAction,
  ArchiviaTappaAction,
} from "@/lib/tappe/annullamento/state";
import { AnnullaTappa } from "./annulla-tappa";
import { ArchiviaTappa } from "./archivia-tappa";

beforeAll(() => {
  // jsdom has no layout: the outcome message scrolls itself into view.
  Element.prototype.scrollIntoView ??= vi.fn();
});

function renderAnnulla(
  action: AnnullaTappaAction,
  props: Partial<Parameters<typeof AnnullaTappa>[0]> = {},
) {
  return render(
    <ToastProvider>
      <AnnullaTappa
        tappaId="t1"
        nome="Tappa 2 · Rimini"
        iscritti={26}
        annullabile
        action={action}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
}

async function apri(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", {
    name: "Annulla tappa: Tappa 2 · Rimini",
  });
  trigger.focus();
  await user.keyboard("{Enter}");
  const dialog = await screen.findByRole("alertdialog", {
    name: "Annullare «Tappa 2 · Rimini»?",
  });
  return { trigger, dialog };
}

describe("AnnullaTappa (w-admin-annulla-tappa)", () => {
  it("si apre da tastiera con il focus su «Non annullare», dice quanti iscritti ci sono e che non parte nessuna email", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AnnullaTappaAction>();
    renderAnnulla(action);

    const { trigger, dialog } = await apri(user);
    expect(dialog).toHaveTextContent(
      "26 iscritti vedranno la tappa annullata nell'app. Non parte nessuna email: se serve, avvisali tu.",
    );
    expect(dialog).not.toHaveTextContent("riceveranno");
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Non annullare" }),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(action).not.toHaveBeenCalled();
  });

  it("il motivo è obbligatorio: errore sul campo, focus lì, niente invio", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AnnullaTappaAction>();
    renderAnnulla(action);
    const { dialog } = await apri(user);

    await user.click(
      within(dialog).getByRole("button", { name: "Annulla tappa" }),
    );
    const motivo = within(dialog).getByRole("textbox", {
      name: /Motivo dell'annullamento/,
    });
    await waitFor(() => expect(motivo).toHaveFocus());
    expect(motivo).toHaveAttribute("aria-invalid", "true");
    expect(motivo).toHaveAccessibleDescription(
      /Indica il motivo dell'annullamento/,
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("conferma: invia tappa e motivo, chiude e porta il focus sull'esito", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AnnullaTappaAction>(async () => ({
      status: "success",
      message:
        "Tappa annullata. Non parte nessuna email: se serve, avvisa tu i 26 iscritti.",
      iscritti: 26,
      at: 1,
    }));
    renderAnnulla(action);
    const { dialog } = await apri(user);

    await user.type(
      within(dialog).getByRole("textbox", { name: /Motivo/ }),
      "Allerta meteo",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Annulla tappa" }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("tappaId")).toBe("t1");
    expect(data.get("motivo")).toBe("Allerta meteo");
    await waitFor(() =>
      expect(
        screen.getByText(
          "Tappa annullata. Non parte nessuna email: se serve, avvisa tu i 26 iscritti.",
          {
            selector: "p[tabindex='-1']",
          },
        ),
      ).toHaveFocus(),
    );
  });

  it("errore di rete: il testo scritto resta e l'errore è annunciato", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AnnullaTappaAction>(async () => {
      throw new Error("offline");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAnnulla(action);
    const { dialog } = await apri(user);
    const motivo = within(dialog).getByRole("textbox", { name: /Motivo/ });
    await user.type(motivo, "Maltempo");
    await user.click(
      within(dialog).getByRole("button", { name: "Annulla tappa" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /controlla la connessione/,
    );
    expect(motivo).toHaveValue("Maltempo");
  });

  it("offline: la conferma è disattivata con il motivo a testo", async () => {
    const user = userEvent.setup();
    renderAnnulla(vi.fn<AnnullaTappaAction>(), { offline: true });
    const { dialog } = await apri(user);
    const conferma = within(dialog).getByRole("button", {
      name: "Annulla tappa",
    });
    expect(conferma).toHaveAttribute("aria-disabled", "true");
    expect(conferma).toHaveAccessibleDescription(/Sei offline/);
  });

  it("una tappa non annullabile non mostra il pulsante", () => {
    renderAnnulla(vi.fn<AnnullaTappaAction>(), { annullabile: false });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ArchiviaTappa", () => {
  function renderArchivia(archiviabile: boolean) {
    const action = vi.fn<ArchiviaTappaAction>();
    render(
      <ToastProvider>
        <ArchiviaTappa
          tappaId="t1"
          nome="Tappa 0 · Lignano"
          archiviabile={archiviabile}
          archiviata={false}
          action={action}
        />
      </ToastProvider>,
    );
    return action;
  }

  it("resta disattivata con la nota finché i risultati non sono chiusi", () => {
    renderArchivia(false);
    const button = screen.getByRole("button", {
      name: "Archivia: Tappa 0 · Lignano",
    });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(
      "Sarà possibile archiviare la tappa dopo la chiusura dei risultati.",
    );
  });

  it("abilitata, chiede conferma con il focus su «Non archiviare»", async () => {
    const user = userEvent.setup();
    renderArchivia(true);
    const button = screen.getByRole("button", {
      name: "Archivia: Tappa 0 · Lignano",
    });
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Archiviare «Tappa 0 · Lignano»?",
    });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Non archiviare" }),
      ).toHaveFocus(),
    );
  });
});
