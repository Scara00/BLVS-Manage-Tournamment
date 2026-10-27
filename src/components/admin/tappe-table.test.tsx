import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminTappa } from "@/lib/admin/tappe";
import { AdminTappeSection } from "./admin-tappe-section";

const tappa = (over: Partial<AdminTappa>): AdminTappa => ({
  id: "t",
  nome: "Tappa",
  periodo: "14–15 giugno",
  stato: "iscrizioni_aperte",
  motivoAnnullamento: null,
  categorie: [
    { categoria: "M", iscritti: 12, posti: 16, fase: "gold", concluso: false },
    { categoria: "F", iscritti: 16, posti: 16, fase: null, concluso: false },
  ],
  partiteDaInserire: 0,
  giornoDiGara: false,
  ...over,
});

const tappe = [
  tappa({ id: "a", nome: "Tappa A" }),
  tappa({ id: "b", nome: "Tappa B in bozza", stato: "bozza" }),
];

function table() {
  return screen.getByRole("table");
}

describe("tabella delle tappe admin", () => {
  it("ha intestazioni di colonna e di riga", () => {
    render(
      <AdminTappeSection tappe={tappe} filtro="tutte" basePath="/admin" />,
    );
    const headers = within(table())
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Tappa",
      "Data",
      "Iscrizioni",
      "Maschile",
      "Femminile",
    ]);
    expect(
      within(table()).getByRole("rowheader", {
        name: "Tappa A: gestisci la tappa",
      }),
    ).toBeInTheDocument();
  });

  it("mostra stato, fase e posti per categoria in testo", () => {
    render(
      <AdminTappeSection tappe={tappe} filtro="tutte" basePath="/admin" />,
    );
    const row = within(table()).getAllByRole("row")[1];
    expect(row).toHaveTextContent("Iscrizioni aperte");
    expect(row).toHaveTextContent("Gold");
    expect(row).toHaveTextContent("12 iscritti su 16 posti");
    expect(row).toHaveTextContent("4 posti liberi");
    expect(row).toHaveTextContent("Fase da definire");
    expect(row).toHaveTextContent("Completo");
  });

  it("il filtro mostra solo le tappe di quello stato e lo segna come attivo", () => {
    render(
      <AdminTappeSection tappe={tappe} filtro="bozza" basePath="/admin" />,
    );
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    expect(table()).toHaveTextContent("Tappa B in bozza");
    expect(table()).not.toHaveTextContent("Tappa A");
    const active = screen.getByRole("link", { current: true });
    expect(active).toHaveAttribute("href", "/admin?stato=bozza");
    expect(screen.getByRole("status")).toHaveTextContent("1 di 2 tappe");
  });

  it("filtro senza risultati: messaggio dedicato", () => {
    render(
      <AdminTappeSection tappe={tappe} filtro="annullata" basePath="/admin" />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText("Nessuna tappa nello stato «Annullata»."),
    ).toBeInTheDocument();
  });

  it("nessuna tappa: messaggio vuoto", () => {
    render(<AdminTappeSection tappe={[]} filtro="tutte" basePath="/admin" />);
    expect(screen.getByText(/Nessuna tappa in calendario/)).toBeInTheDocument();
  });
});
