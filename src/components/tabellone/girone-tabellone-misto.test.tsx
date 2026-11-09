import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GironeTabellone, RigaTabellone } from "@/lib/tabellone/types";
import { GironeTabelloneCard } from "./girone-tabellone";

const riga = (
  playerId: string,
  category: "M" | "F",
  position: number,
): RigaTabellone => ({
  playerId,
  name: `Giocatore ${playerId}`,
  category,
  position,
  pari: false,
  played: 4,
  won: 4 - position,
  diff: 0,
  points: 80,
});

const girone: GironeTabellone = {
  id: "g1",
  nome: "Girone A",
  fase: "iniziale",
  livello: "iniziale",
  colore: null,
  stato: "completo",
  taglio: { dopo: 2, sopra: "gironi gold", sotto: "gironi silver" },
  rows: [
    riga("m1", "M", 1),
    riga("m2", "M", 2),
    riga("m3", "M", 3),
    riga("m4", "M", 4),
    riga("f1", "F", 1),
    riga("f2", "F", 2),
    riga("f3", "F", 3),
    riga("f4", "F", 4),
  ],
};

describe("girone del tabellone misto", () => {
  it("una tabella per categoria, con la linea dopo il 2° di ciascuna", () => {
    render(<GironeTabelloneCard girone={girone} me="f3" />);
    for (const nome of ["uomini", "donne"]) {
      const tabella = screen.getByRole("table", {
        name: `Classifica Girone A · ${nome}`,
      });
      expect(tabella.querySelectorAll("tr[data-taglio=dopo]")).toHaveLength(1);
    }
    expect(screen.getByTestId("taglio")).toHaveTextContent(
      "Linea di taglio dopo il 2° posto di uomini e donne",
    );
    expect(screen.getByTestId("taglio-mio")).toHaveTextContent(
      "sotto la linea: gironi silver",
    );
  });

  it("il classico resta una tabella sola", () => {
    render(
      <GironeTabelloneCard
        girone={{
          ...girone,
          rows: girone.rows
            .slice(0, 4)
            .map((r) => ({ ...r, category: undefined })),
        }}
        me={null}
      />,
    );
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(
      within(screen.getByTestId("taglio")).queryByText(/uomini e donne/),
    ).toBeNull();
  });
});
