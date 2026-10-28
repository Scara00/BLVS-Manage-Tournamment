import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lineaDiTaglio } from "@/lib/live/girone";
import type { GroupStandingRow } from "@/lib/live/types";
import { ClassificaGirone } from "./classifica-girone";

const rows: GroupStandingRow[] = [
  ["i1", "Rossi Luca", 2, 63, 50],
  ["i2", "Bianchi Marco", 2, 61, 55],
  ["i3", "Verdi Paolo", 1, 55, 59],
  ["i4", "Neri Ugo", 1, 48, 63],
].map(([id, nome, won, pf, ps], i) => ({
  position: i + 1,
  playerId: id as string,
  pair: nome as string,
  played: 3,
  won: won as number,
  points: pf as number,
  against: ps as number,
  diff: (pf as number) - (ps as number),
}));

function renderClassifica(me: string | null = "i1") {
  render(
    <ClassificaGirone
      label="Girone A"
      rows={rows}
      linea={lineaDiTaglio({ fase: "iniziale", gironiDellaFase: 4 }, rows)}
      me={me}
      reducedMotion
    />,
  );
  return screen.getByRole("table", { name: "Classifica Girone A" });
}

describe("ClassificaGirone", () => {
  it("colonne Pos., Giocatore, PG, V, PF, PS, Diff con th scope=col e nome intero", () => {
    const table = renderClassifica();
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.getAttribute("scope"))).toEqual(
      Array(7).fill("col"),
    );
    expect(headers.map((h) => h.textContent)).toEqual([
      "Pos.Posizione",
      "Giocatore",
      "PGPartite giocate",
      "VVittorie",
      "PFPunti fatti",
      "PSPunti subiti",
      "DiffDifferenza punti",
    ]);
    const abbr = table.querySelector("abbr[title='Punti subiti']");
    expect(abbr).toHaveTextContent("PS");
    expect(abbr).toHaveAttribute("aria-hidden", "true");
  });

  it("il nome del giocatore è un th scope=row; valori in mono con il segno", () => {
    const table = renderClassifica();
    const names = within(table).getAllByRole("rowheader");
    expect(names.map((n) => n.getAttribute("scope"))).toEqual(
      Array(4).fill("row"),
    );
    expect(names[0]).toHaveTextContent("Rossi LucaTu");
    const prima = names[0].closest("tr")!;
    expect(prima).toHaveAttribute("data-mia", "true");
    expect(
      within(prima)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["1", "3", "2", "63", "50", "+13"]);
    const ultima = names[3].closest("tr")!;
    expect(ultima).toHaveTextContent("−15");
  });

  it("linea di taglio a testo dopo il 2°: «★ Gold» sopra, «◆ Silver» sotto", () => {
    const table = renderClassifica();
    const linea = table.querySelector("[data-slot=linea-taglio]")!;
    expect(linea).toHaveTextContent(
      "Linea di taglio.▲ Sopra la linea: ★ Gold▼ Sotto la linea: ◆ Silver",
    );
    const righe = [...table.querySelectorAll("tbody tr")];
    expect(righe.indexOf(linea as HTMLTableRowElement)).toBe(2);
    expect(righe[1]).toHaveAttribute("data-fascia", "sopra");
    expect(righe[3]).toHaveAttribute("data-fascia", "sotto");
  });

  it("schede (390 px): posizione, nome, V e Diff soltanto", () => {
    renderClassifica();
    const list = screen.getByRole("list", { name: "Classifica Girone A" });
    const cards = within(list)
      .getAllByRole("listitem")
      .filter((li) => !li.hasAttribute("data-slot"));
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent(
      "Posizione 1Rossi LucaTuVittorie2Diff.Differenza punti+13",
    );
    expect(cards[0]).not.toHaveTextContent("63");
    expect(
      within(list).getByText("Gold", { exact: false }).closest("li"),
    ).toHaveAttribute("data-slot", "linea-taglio");
  });

  it("vuota: un messaggio, nessuna tabella", () => {
    render(
      <ClassificaGirone label="Girone A" rows={[]} linea={null} me={null} />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getByText(
        "La classifica compare dopo il primo risultato del girone.",
      ),
    ).toBeInTheDocument();
  });
});
