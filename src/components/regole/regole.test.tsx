import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { spiegaRegolaClassifica } from "@/lib/gironi/classifica/criteri";
import { REGOLA_SET } from "@/lib/punteggi/regola";
import { CONFIG_REGOLE, regoleDelCircuito } from "@/lib/regole/regole";
import { Regole } from "./regole";

const sezione = (nome: string) =>
  screen.getByRole("region", { name: new RegExp(nome) });

describe("Regole", () => {
  it("segna «da confermare» a testo le sezioni aperte, non i punti", () => {
    render(<Regole />);
    for (const nome of [
      "Il formato della tappa",
      "Il set",
      "Classifica del girone",
      "Classifica generale",
    ]) {
      expect(within(sezione(nome)).getByText("da confermare")).toBeVisible();
    }
    expect(
      within(sezione("Punti di tappa")).queryByText("da confermare"),
    ).toBeNull();
  });

  it("mostra tre passi, ciascuno con titolo a testo", () => {
    render(<Regole />);
    const passi = within(sezione("Il formato della tappa")).getAllByRole(
      "listitem",
    );
    expect(passi).toHaveLength(3);
    expect(passi[2]).toHaveTextContent("Passo 3");
    expect(passi[2]).toHaveTextContent("Finali");
  });

  it("il testo viene dalla configurazione", () => {
    render(<Regole />);
    expect(sezione("Il set")).toHaveTextContent(
      `Si vince a ${REGOLA_SET.punti}`,
    );
    const criteri = within(sezione("Classifica del girone")).getAllByRole(
      "listitem",
    );
    expect(criteri.map((li) => li.textContent)).toEqual(
      spiegaRegolaClassifica(),
    );
  });

  it("senza regole aperte non c'è nessuna etichetta", () => {
    render(
      <Regole regole={regoleDelCircuito({ ...CONFIG_REGOLE, aperte: {} })} />,
    );
    expect(screen.queryByText("da confermare")).toBeNull();
  });

  it("sessione scaduta: avviso sopra le regole, che restano visibili", () => {
    render(<Regole sessioneScaduta />);
    expect(
      screen.getByRole("heading", { name: "Sessione scaduta" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute("href", "/accesso?da=%2Fregole&motivo=scaduta");
    expect(sezione("Punti di tappa")).toBeVisible();
  });
});
