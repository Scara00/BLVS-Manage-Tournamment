import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "./responsive-table";

type Row = { position: number; pair: string; points: number };

const LONG_NAME =
  "Bruno-Gallo de Santis Mancinelli / Conti Lombardi Bartolomei-Fioravanti";

const rows: Row[] = [
  { position: 1, pair: "Rossi / Bianchi", points: 420 },
  { position: 2, pair: LONG_NAME, points: 385 },
];

const columns: ResponsiveTableColumn<Row>[] = [
  { key: "position", header: "Posizione", numeric: true },
  { key: "pair", header: "Coppia", rowHeader: true },
  { key: "points", header: "Punti", numeric: true },
];

function renderTable(captionHidden = false) {
  return render(
    <ResponsiveTable
      caption="Classifica generale"
      captionHidden={captionHidden}
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.pair}
      cardBadgeKey="position"
    />,
  );
}

describe("ResponsiveTable", () => {
  it("ha una caption che dà il nome alla tabella", () => {
    renderTable();
    expect(
      screen.getByRole("table", { name: "Classifica generale" }),
    ).toBeInTheDocument();
  });

  it("ogni intestazione di colonna ha scope=col e il nome è th scope=row", () => {
    const { container } = renderTable();
    const headers = container.querySelectorAll("thead th");
    expect(headers).toHaveLength(3);
    headers.forEach((th) => expect(th).toHaveAttribute("scope", "col"));

    const rowHeaders = container.querySelectorAll('tbody th[scope="row"]');
    expect([...rowHeaders].map((th) => th.textContent)).toEqual([
      "Rossi / Bianchi",
      LONG_NAME,
    ]);
  });

  it("le colonne numeriche usano cifre tabulari allineate a destra", () => {
    const { container } = renderTable();
    const points = container.querySelector("tbody td:last-child");
    expect(points).toHaveClass("font-mono", "tabular-nums", "text-end");
  });

  it("tabella da md, card sotto md", () => {
    const { container } = renderTable();
    expect(container.querySelector("table")).toHaveClass("hidden", "md:table");
    expect(container.querySelector("ol")!.parentElement).toHaveClass(
      "md:hidden",
    );
  });

  it("stackBelow=lg: card fino a lg, per tabelle fitte con pulsanti", () => {
    const { container } = render(
      <ResponsiveTable
        caption="Iscritti"
        columns={[{ key: "nome", header: "Nome", rowHeader: true }]}
        rows={[{ nome: "Rossi Luca" }]}
        getRowKey={(row) => row.nome}
        stackBelow="lg"
      />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveClass("hidden", "lg:table");
    expect(table).not.toHaveClass("md:table");
    expect(container.querySelector("ol")!.parentElement).toHaveClass(
      "lg:hidden",
    );
  });

  it("la lista di card ha un nome e segue l'ordine posizione → nome → punti", () => {
    renderTable(true);
    const list = screen.getByRole("list", { name: "Classifica generale" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toBe("Posizione 1Rossi / BianchiPunti420");
  });

  it("con la caption visibile la lista è etichettata dal titolo", () => {
    renderTable(false);
    expect(
      screen.getByRole("list", { name: "Classifica generale" }),
    ).toBeInTheDocument();
  });

  it("un nome lungo viene mostrato per intero e può andare a capo", () => {
    const { container } = renderTable();
    const cells = screen.getAllByText(LONG_NAME);
    expect(cells).toHaveLength(2);
    cells.forEach((cell) => {
      expect(cell).toHaveClass("[overflow-wrap:anywhere]");
      expect(cell).not.toHaveClass("truncate");
    });
    expect(container.querySelector("table")).toHaveClass("table-fixed");
  });
});

describe("ResponsiveTable · allineamento", () => {
  it("align esplicito vince sul default numerico", () => {
    const { container } = render(
      <ResponsiveTable
        caption="Classifica"
        columns={[
          {
            key: "position",
            header: "Posizione",
            numeric: true,
            align: "start",
          },
          { key: "pair", header: "Coppia", rowHeader: true },
        ]}
        rows={rows}
        getRowKey={(r) => r.pair}
      />,
    );
    expect(container.querySelector("tbody td")).toHaveClass("text-start");
    expect(container.querySelector("thead th")).toHaveClass("text-start");
  });

  it("senza righe mostra il messaggio di lista vuota al posto di tabella e card", () => {
    render(
      <ResponsiveTable
        caption="Classifica generale"
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.pair}
        emptyMessage="Nessuna coppia in classifica."
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Classifica generale" }),
    ).toHaveTextContent("Nessuna coppia in classifica.");
  });
});
