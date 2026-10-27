import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CaricaPrecedentiAction } from "@/lib/registro/types";
import { RegistroTappa } from "./registro-tappa";
import { paginaPrecedente, registroStorie } from "./stories-data";

vi.mock("next/form", () => ({
  default: ({ action, ...props }: ComponentProps<"form">) => (
    <form action={typeof action === "string" ? action : undefined} {...props} />
  ),
}));

function renderRegistro(
  props: Partial<ComponentProps<typeof RegistroTappa>> = {},
) {
  const carica = vi.fn<CaricaPrecedentiAction>(async () => ({
    status: "ok",
    pagina: paginaPrecedente(3),
  }));
  render(
    <RegistroTappa
      registro={registroStorie({ restanti: 3 })}
      caricaPrecedenti={carica}
      online
      {...props}
    />,
  );
  return { carica };
}

describe("RegistroTappa", () => {
  it("raggruppa per giorno, con intestazioni di riga e nessuna azione di modifica", () => {
    renderRegistro();
    const giorni = screen.getAllByRole("heading", { level: 2 });
    expect(giorni.map((h) => h.textContent)).toEqual([
      "Oggi · sabato 12 giugno",
      "Ieri · venerdì 11 giugno",
      "mercoledì 9 giugno",
    ]);
    const oggi = screen.getByRole("region", {
      name: "Oggi · sabato 12 giugno",
    });
    const tabella = within(oggi).getByRole("table", { hidden: true });
    expect(
      within(tabella)
        .getAllByRole("columnheader", { hidden: true })
        .every((th) => th.getAttribute("scope") === "col"),
    ).toBe(true);
    expect(
      within(tabella).getAllByRole("rowheader", { hidden: true })[0],
    ).toHaveAttribute("scope", "row");

    // Only the filters and the load button: nothing edits an entry.
    const pulsanti = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(pulsanti).toEqual([
      "Applica i filtri",
      "Mostra le 3 voci precedenti",
    ]);
  });

  it("solo le eccezioni sono badge pieni", () => {
    renderRegistro();
    const badge = screen
      .getAllByTestId("badge-eccezione")
      .map((b) => b.textContent);
    expect(new Set(badge)).toEqual(new Set(["Correzione", "Parità risolta"]));
    expect(screen.getAllByText("Inserimento").length).toBeGreaterThan(0);
  });

  it("carica le voci precedenti su richiesta, poi annuncia la fine", async () => {
    const user = userEvent.setup();
    const { carica } = renderRegistro();
    const pulsante = screen.getByRole("button", {
      name: "Mostra le 3 voci precedenti",
    });
    await user.click(pulsante);
    expect(carica).toHaveBeenCalledWith(
      "jesolo",
      { tipo: null, partita: null },
      993,
    );
    const stato = await screen.findByTestId("registro-annuncio");
    await waitFor(() =>
      expect(stato).toHaveTextContent(
        "Caricate 3 voci precedenti. Non ci sono altre voci.",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "martedì 8 giugno" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /precedent/ })).toBeNull();
    await waitFor(() => expect(stato).toHaveFocus());
  });

  it("mostra l'errore e tiene il pulsante", async () => {
    const user = userEvent.setup();
    renderRegistro({
      caricaPrecedenti: async () => ({ status: "error", message: "Riprova." }),
    });
    await user.click(
      screen.getByRole("button", { name: "Mostra le 3 voci precedenti" }),
    );
    expect(await screen.findByText("Riprova.")).toBeInTheDocument();
    // The button stays, back from its loading state.
    expect(
      await screen.findByRole("button", {
        name: "Mostra le 3 voci precedenti",
      }),
    ).toBeEnabled();
  });

  it("i filtri sono un modulo GET con i valori correnti", () => {
    renderRegistro({
      registro: registroStorie({
        filtri: { tipo: "correzione_punteggio", partita: null },
      }),
    });
    const modulo = screen.getByRole("form", { name: "Filtra il registro" });
    expect(modulo).toHaveAttribute("action", "/admin/tappe/jesolo/registro");
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue(
      "correzione_punteggio",
    );
    expect(screen.getByText("Filtri:").parentElement).toHaveTextContent(
      "Filtri: Correzione punteggio",
    );
    expect(
      screen.getByRole("link", { name: "Azzera i filtri" }),
    ).toHaveAttribute("href", "/admin/tappe/jesolo/registro");
  });

  it("vuoto, anche per i filtri", () => {
    renderRegistro({ registro: registroStorie({ voci: 0 }) });
    expect(screen.getByText("Il registro è ancora vuoto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /precedent/ })).toBeNull();
  });

  it("offline: avvisa e non carica altre voci", () => {
    renderRegistro({ online: false });
    expect(screen.getByText(/Sei offline\./)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mostra le 3 voci precedenti" }),
    ).toBeDisabled();
  });
});
