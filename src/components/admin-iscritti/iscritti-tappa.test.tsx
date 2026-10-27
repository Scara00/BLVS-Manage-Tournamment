import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type {
  CercaGiocatoriAction,
  ModificaIscrittiAction,
} from "@/lib/iscrizioni/admin/types";
import { IscrittiTappa } from "./iscritti-tappa";
import { giocatoriTrovati, iscrittiDemo } from "./stories-data";

function renderIscritti(
  props: Partial<Parameters<typeof IscrittiTappa>[0]> = {},
) {
  const aggiungi = vi.fn<ModificaIscrittiAction>(async () => ({
    status: "success",
    message: "Rossetti Lorenzo ora ha il posto 7.",
    at: 1,
  }));
  const rimuovi = vi.fn<ModificaIscrittiAction>(async () => ({
    status: "success",
    message: "Iscrizione di Rossi Luca rimossa: il posto 1 è di nuovo libero.",
    at: 1,
  }));
  const cerca = vi.fn<CercaGiocatoriAction>(async () => ({
    status: "ok",
    giocatori: giocatoriTrovati,
  }));
  render(
    <ToastProvider>
      <IscrittiTappa
        tappa={iscrittiDemo()}
        aggiungi={aggiungi}
        rimuovi={rimuovi}
        cerca={cerca}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
  return { aggiungi, rimuovi, cerca };
}

function tabellone(nome: string) {
  return screen.getByRole("region", { name: nome });
}

describe("IscrittiTappa (w-admin-iscritti)", () => {
  it("divide gli iscritti per tabellone, con i posti liberi a testo", () => {
    renderIscritti();
    const m = tabellone("Tabellone maschile");
    expect(within(m).getByTestId("posti-liberi")).toHaveTextContent(
      "2 POSTI LIBERI",
    );
    const tabella = within(m).getByRole("table", {
      name: "Iscritti al tabellone maschile",
    });
    const riga = within(tabella).getByRole("row", { name: /Rossi Luca/ });
    const celle = within(riga).getAllByRole("cell");
    expect(celle[0]).toHaveTextContent("1");
    expect(celle[0]).toHaveClass("font-mono");
    expect(celle[1]).toHaveClass("font-mono");
    expect(celle[1]).toHaveTextContent(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(
      within(tabellone("Tabellone femminile")).getByTestId("posti-liberi"),
    ).toHaveTextContent("5 POSTI LIBERI");
  });

  it("una tappa in corso è in sola lettura ma si esporta", () => {
    renderIscritti({ tappa: iscrittiDemo({ stato: "in_corso" }) });
    expect(
      screen.queryByRole("button", { name: "Aggiungi giocatore" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Rimuovi/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esporta CSV" })).toBeVisible();
    expect(
      screen.getByText(/in corso o conclusa gli iscritti non cambiano più/),
    ).toBeVisible();
  });

  it("cerca, annuncia quanti giocatori ha trovato e spiega chi non si può aggiungere", async () => {
    const user = userEvent.setup();
    const { cerca, aggiungi } = renderIscritti({
      tappa: iscrittiDemo({ f: 8 }),
    });
    await user.click(
      screen.getByRole("button", { name: "Aggiungi giocatore" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Aggiungi giocatore",
    });
    const input = within(dialog).getByRole("searchbox", {
      name: /Cerca per nome, cognome o email/,
    });
    await waitFor(() => expect(input).toHaveFocus());

    await user.type(input, "r");
    const stato = within(dialog).getByRole("status");
    await waitFor(() =>
      expect(stato).toHaveTextContent("Scrivi almeno 2 caratteri."),
    );
    expect(cerca).not.toHaveBeenCalled();

    await user.type(input, "os{Enter}");
    await waitFor(() =>
      expect(stato).toHaveTextContent("4 giocatori trovati."),
    );
    expect(cerca).toHaveBeenLastCalledWith("rimini", "ros");

    const risultati = within(dialog).getByRole("list", {
      name: "Giocatori trovati",
    });
    expect(
      within(risultati).getByRole("button", { name: "Aggiungi Rossi Luca" }),
    ).toHaveAccessibleDescription("Già iscritto a questa tappa.");
    expect(
      within(risultati).getByRole("button", { name: "Aggiungi Rossini Elena" }),
    ).toHaveAccessibleDescription("Tabellone femminile al completo.");
    expect(
      within(risultati).getByRole("button", { name: "Aggiungi Rosso Niccolò" }),
    ).toHaveAccessibleDescription("Non ha ancora scelto la categoria.");

    await user.click(
      within(risultati).getByRole("button", {
        name: "Aggiungi Rossetti Lorenzo",
      }),
    );
    expect(aggiungi).toHaveBeenCalledOnce();
    const formData = aggiungi.mock.calls[0][1];
    expect(formData.get("utenteId")).toBe("g1");
    expect(formData.get("tappaId")).toBe("rimini");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(
      await screen.findByText("Rossetti Lorenzo ora ha il posto 7."),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Aggiungi giocatore" }),
      ).toHaveFocus(),
    );
  });

  it("mostra l'errore del server (posti esauriti) senza chiudere", async () => {
    const user = userEvent.setup();
    const aggiungi = vi.fn<ModificaIscrittiAction>(async () => ({
      status: "error",
      reason: "invalid",
      message: "Posti esauriti in questo tabellone.",
      at: 2,
    }));
    renderIscritti({ aggiungi });
    await user.click(
      screen.getByRole("button", { name: "Aggiungi giocatore" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("searchbox"), "lor{Enter}");
    await user.click(
      await within(dialog).findByRole("button", {
        name: "Aggiungi Rossetti Lorenzo",
      }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Posti esauriti in questo tabellone.",
    );
  });

  it("rimuove dopo la conferma e porta il focus sul messaggio del tabellone", async () => {
    const user = userEvent.setup();
    const { rimuovi } = renderIscritti();
    const m = tabellone("Tabellone maschile");
    const tabella = within(m).getByRole("table");
    await user.click(
      within(tabella).getByRole("button", { name: "Rimuovi Rossi Luca" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Rimuovere Rossi Luca dal posto 1?",
    });
    expect(dialog).toHaveAccessibleDescription(/il posto torna libero/);
    await user.click(within(dialog).getByRole("button", { name: "Rimuovi" }));

    expect(rimuovi.mock.calls[0][1].get("iscrizioneId")).toBe("M-1");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    const esito = within(m).getByTestId("iscritti-esito");
    expect(esito).toHaveTextContent("il posto 1 è di nuovo libero");
    await waitFor(() => expect(esito).toHaveFocus());
  });

  it("«Annulla» non rimuove e ridà il focus al pulsante", async () => {
    const user = userEvent.setup();
    const { rimuovi } = renderIscritti();
    const tabella = within(tabellone("Tabellone maschile")).getByRole("table");
    const trigger = within(tabella).getByRole("button", {
      name: "Rimuovi Bianchi Marco",
    });
    await user.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Annulla" }),
      ).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(rimuovi).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
