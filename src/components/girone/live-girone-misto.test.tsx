import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import meta from "./live-girone-misto.stories";

const GironeMisto = meta.component;

describe("w-girone nel misto", () => {
  it("mostra in evidenza le due partite del turno in corso", () => {
    render(<GironeMisto {...meta.args} />);
    const inCampo = screen.getByRole("region", { name: "In campo adesso" });
    expect(within(inCampo).getAllByTestId("girone-in-corso")).toHaveLength(2);
  });

  it("classifica uomini e donne a parte, ognuna con la sua linea gold", () => {
    render(<GironeMisto {...meta.args} giocati={4} inCorso={null} />);
    const classifica = screen.getByRole("region", { name: /Classifica/ });
    expect(
      within(classifica)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Uomini", "Donne"]);
    for (const nome of ["uomini", "donne"]) {
      const tabella = within(classifica).getByRole("table", {
        name: `Classifica Girone A · ${nome}`,
      });
      // Player rows only: the cut line is a row of its own.
      const posizioni = within(tabella)
        .getAllByRole("row")
        .filter((r) => within(r).queryByRole("rowheader"))
        .map((r) => within(r).getAllByRole("cell")[0].textContent);
      expect(posizioni).toEqual(["1", "2", "3", "4"]);
    }
    // Una linea per categoria, dopo il 2° posto.
    expect(
      classifica.querySelectorAll("table [data-slot=linea-taglio]"),
    ).toHaveLength(2);
  });
});
