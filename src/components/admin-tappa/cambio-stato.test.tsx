import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { CambioStatoAction } from "@/lib/tappe/gestione-state";
import { toGestioneTappaView } from "@/lib/tappe/gestione-format";
import { CambioStato } from "./cambio-stato";

const AT = new Date("2027-05-01T10:00:00Z");

const view = toGestioneTappaView(
  {
    id: "t1",
    nome: "Tappa 4 · Bari",
    luogo: "Bari",
    data_inizio: "2027-07-31",
    data_fine: "2027-08-01",
    stato: "bozza",
    iscrizioni_aprono_il: null,
    iscrizioni_chiudono_il: "2027-07-24T21:59:00Z",
    iscrizioni_chiuse_il: null,
    chiusura_automatica: false,
  },
  [],
  AT,
);

function renderCambio(
  action: CambioStatoAction,
  props: Partial<Parameters<typeof CambioStato>[0]> = {},
) {
  return render(
    <ToastProvider>
      <CambioStato
        tappaId="t1"
        transizione={view.transizione}
        action={action}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
}

describe("CambioStato (w-admin-stato-conferma)", () => {
  it("si apre da tastiera, spiega l'effetto e parte da «Annulla»", async () => {
    const user = userEvent.setup();
    const action = vi.fn<CambioStatoAction>();
    renderCambio(action);

    const trigger = screen.getByRole("button", { name: "Apri le iscrizioni" });
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("alertdialog", {
      name: "Aprire le iscrizioni?",
    });
    expect(dialog).toHaveAccessibleDescription(
      /La tappa diventerà visibile ai giocatori/,
    );
    const confronto = within(dialog).getByRole("table", {
      name: "Cosa cambia",
    });
    expect(
      within(confronto).getByRole("row", { name: /Visibile ai giocatori/ }),
    ).toHaveTextContent("No, è una bozza→ Sì");
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Annulla" }),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(action).not.toHaveBeenCalled();
  });

  it("conferma: invia la transizione, chiude e mostra un toast", async () => {
    const user = userEvent.setup();
    const action = vi.fn<CambioStatoAction>(async (_prev, data) => {
      expect(Object.fromEntries(data)).toEqual({
        tappaId: "t1",
        da: "bozza",
        a: "iscrizioni_aperte",
      });
      return {
        status: "success",
        stato: "iscrizioni_aperte",
        message: "Iscrizioni aperte: la tappa è visibile ai giocatori.",
        at: 1,
      };
    });
    renderCambio(action);

    await user.click(
      screen.getByRole("button", { name: "Apri le iscrizioni" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Apri le iscrizioni" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(action).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        "Iscrizioni aperte: la tappa è visibile ai giocatori.",
      ),
    ).toBeInTheDocument();
  });

  it("un errore resta nel dialog come alert", async () => {
    const user = userEvent.setup();
    renderCambio(async () => ({
      status: "error",
      reason: "permissionDenied",
      message: "Solo l'amministrazione può cambiare lo stato di una tappa.",
      at: 1,
    }));

    await user.click(
      screen.getByRole("button", { name: "Apri le iscrizioni" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Apri le iscrizioni" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Solo l'amministrazione",
    );
  });

  it("una richiesta fallita (rete) diventa un errore leggibile", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderCambio(async () => {
      throw new TypeError("Failed to fetch");
    });

    await user.click(
      screen.getByRole("button", { name: "Apri le iscrizioni" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Apri le iscrizioni" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /controlla la connessione/,
    );
  });

  it("offline: la conferma resta focalizzabile ma bloccata, con il motivo", async () => {
    const user = userEvent.setup();
    const action = vi.fn<CambioStatoAction>();
    renderCambio(action, { offline: true, defaultOpen: true });

    const dialog = await screen.findByRole("alertdialog");
    const conferma = within(dialog).getByRole("button", {
      name: "Apri le iscrizioni",
    });
    expect(conferma).toHaveAttribute("aria-disabled", "true");
    expect(conferma).toHaveAccessibleDescription(/Sei offline/);
    await user.click(conferma);
    expect(action).not.toHaveBeenCalled();
  });

  it("una bozza senza scadenza non si apre e dice perché", () => {
    const bloccata = toGestioneTappaView(
      {
        id: "t1",
        nome: "Bari",
        luogo: "Bari",
        data_inizio: "2027-07-31",
        data_fine: "2027-08-01",
        stato: "bozza",
        iscrizioni_aprono_il: null,
        iscrizioni_chiudono_il: null,
        iscrizioni_chiuse_il: null,
        chiusura_automatica: false,
      },
      [],
      AT,
    ).transizione;
    renderCambio(vi.fn(), { transizione: bloccata });
    const trigger = screen.getByRole("button", { name: "Apri le iscrizioni" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAccessibleDescription(/Imposta prima la scadenza/);
  });
});
