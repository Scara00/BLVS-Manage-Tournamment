import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { demoTappeGiocatore } from "@/lib/demo/tournament";
import { toTappeGiocatore } from "@/lib/tappe/format";
import { TappeElenco } from "./tappe-elenco";
import { TappeTable } from "./tappe-table";

const { tappe: righe, posti, categoria } = demoTappeGiocatore;
const tappe = toTappeGiocatore(righe, posti, categoria);

function table() {
  return screen.getByRole("table", { name: "Calendario delle tappe" });
}

function row(name: RegExp) {
  return within(table()).getByRole("row", { name });
}

describe("TappeTable", () => {
  it("è una tabella con le intestazioni di colonna", () => {
    render(<TappeTable tappe={tappe} connesso />);
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      "Tappa",
      "Data",
      "Luogo",
      "Scadenza iscrizioni",
      "Posti",
      "Stato",
      "Fase",
      "Iscrizione",
    ]);
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(4);
  });

  it("non mostra la bozza", () => {
    render(<TappeTable tappe={tappe} connesso />);
    expect(screen.queryByText(/Lignano/)).toBeNull();
  });

  it("mostra «N liberi su M» nella categoria e il link Iscriviti", () => {
    render(<TappeTable tappe={tappe} connesso />);
    const rimini = row(/Rimini/);
    expect(within(rimini).getByText("5 liberi su 16")).toBeTruthy();
    expect(
      within(rimini).getByRole("link", {
        name: "Iscriviti a Tappa 2 · Rimini",
      }),
    ).toHaveAttribute("href", "/tappe/rimini");
  });

  it("la tappa annullata dice «Annullata» e non si può iscriversi", () => {
    render(<TappeTable tappe={tappe} connesso />);
    const pescara = row(/Pescara/);
    expect(within(pescara).getAllByText(/Annullata/i).length).toBeGreaterThan(
      0,
    );
    expect(
      within(pescara).queryByRole("link", { name: /Iscriviti/ }),
    ).toBeNull();
  });

  it("ogni tappa ha «Vedi la tappa», che porta al dettaglio (BLVS-24)", () => {
    render(<TappeTable tappe={tappe} connesso />);
    expect(
      within(row(/Pescara/)).getByRole("link", {
        name: "Vedi la tappa Tappa 4 · Pescara",
      }),
    ).toHaveAttribute("href", "/tappe/pescara");
    expect(
      within(table()).getAllByRole("link", { name: /^Vedi la tappa/ }),
    ).toHaveLength(4);
  });

  it("senza sessione invita ad accedere invece dei posti", () => {
    const anonimo = toTappeGiocatore(righe, posti, null);
    render(<TappeTable tappe={anonimo} connesso={false} />);
    expect(
      within(row(/Rimini/)).getByRole("link", {
        name: "Accedi per vedere i posti",
      }),
    ).toHaveAttribute("href", "/accesso?da=%2Ftappe");
    expect(
      within(table()).queryByRole("link", { name: /Iscriviti/ }),
    ).toBeNull();
  });
});

describe("TappeElenco", () => {
  it("in testa la striscia live quando una tappa è in corso", () => {
    render(<TappeElenco tappe={tappe} connesso offline={false} />);
    const strip = screen.getByRole("region", {
      name: "In corso: Tappa 1 · Jesolo · Fase Gironi",
    });
    expect(
      within(strip).getByRole("link", { name: "Segui il live" }),
    ).toHaveAttribute("href", "/tappe/jesolo/live");
  });

  it("senza tappe in corso niente striscia", () => {
    render(
      <TappeElenco
        tappe={tappe.filter((t) => t.stato !== "in_corso")}
        connesso
        offline={false}
      />,
    );
    expect(screen.queryByRole("region", { name: /In corso/ })).toBeNull();
  });

  it("offline avvisa che i dati potrebbero non essere aggiornati", () => {
    render(<TappeElenco tappe={tappe} connesso offline />);
    expect(screen.getByRole("status").textContent).toMatch(/Sei offline/);
  });
});
