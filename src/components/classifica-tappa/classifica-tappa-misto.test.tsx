import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import meta from "./classifica-tappa-misto.stories";

const ClassificaMista = meta.component;

describe("w-classifica-tappa nel misto", () => {
  it("una tabella per finale e categoria, con King e Queen in gold", () => {
    render(<ClassificaMista {...meta.args} />);
    const nomi = screen
      .getAllByRole("table")
      .map((t) => t.querySelector("caption")?.textContent);
    expect(nomi).toEqual([
      "Finale gold · Uomini",
      "Finale gold · Donne",
      "Finale silver · Uomini",
      "Finale silver · Donne",
    ]);
    const goldUomini = screen.getByRole("table", {
      name: "Finale gold · Uomini",
    });
    expect(within(goldUomini).getByText("King")).toBeInTheDocument();
    const goldDonne = screen.getByRole("table", {
      name: "Finale gold · Donne",
    });
    expect(within(goldDonne).getByText("Queen")).toBeInTheDocument();
    // Il 1° uomo e la 1ª donna non sono «a pari merito».
    expect(within(goldUomini).queryByText("a pari merito")).toBeNull();
  });

  it("«La tua tappa» dice posizione e categoria, senza punti", () => {
    render(<ClassificaMista {...meta.args} />);
    const mia = screen.getByTestId("la-tua-tappa");
    expect(mia).toHaveTextContent("1ª");
    expect(mia).toHaveTextContent("tra gli uomini");
    expect(mia).toHaveTextContent("King");
    expect(within(mia).queryByText("Punti")).toBeNull();
    expect(within(mia).getByTestId("la-tua-tappa-punti")).toHaveTextContent(
      "Il misto non assegna punti",
    );
  });

  it("la silver riparte dal 5° per categoria", () => {
    render(<ClassificaMista {...meta.args} />);
    const silverDonne = screen.getByRole("table", {
      name: "Finale silver · Donne",
    });
    const prima = within(silverDonne).getAllByRole("row")[1];
    expect(within(prima).getAllByRole("cell")[0]).toHaveTextContent("5");
  });
});
