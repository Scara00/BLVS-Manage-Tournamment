import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "@/test/match-media";
import { PunteggioParziale } from "./punteggio-parziale";

const partial = (home: number, away: number) => ({
  home,
  away,
  updatedAt: "2027-06-12T08:42:00.000Z",
});

describe("PunteggioParziale (BLVS-37)", () => {
  let media: ReturnType<typeof mockMatchMedia> | undefined;
  afterEach(() => media?.restore());

  it("cifre mono, etichetta Parziale e una sola frase per i lettori di schermo", () => {
    media = mockMatchMedia(false);
    const { container, getByTestId } = render(
      <PunteggioParziale partial={partial(14, 11)} home="Rossi" away="Greco" />,
    );
    expect(container).toHaveTextContent("Parziale · in corso");
    expect(container).toHaveTextContent("Non entra in classifica");
    expect(
      getByTestId("punteggio-parziale").querySelector(".sr-only"),
    ).toHaveTextContent("Parziale: Rossi 14, Greco 11");
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(container.querySelector("[data-slot=flip-digits]")).toHaveClass(
      "font-mono",
    );
  });

  it("al cambio gira la paletta e segna sul nastro il lato cambiato", () => {
    media = mockMatchMedia(false);
    const { container, rerender } = render(
      <PunteggioParziale partial={partial(14, 11)} home="A" away="B" />,
    );
    rerender(<PunteggioParziale partial={partial(14, 12)} home="A" away="B" />);
    expect(container.querySelector(".animate-flip-top")).not.toBeNull();
    const cambiato = container.querySelector("[data-cambiato]");
    expect(cambiato).toHaveClass("border-tape");
    expect(cambiato).toHaveTextContent("12");
  });

  it("con riduzione del movimento le cifre cambiano senza paletta", () => {
    media = mockMatchMedia(true);
    const { container, rerender } = render(
      <PunteggioParziale partial={partial(14, 11)} home="A" away="B" />,
    );
    rerender(<PunteggioParziale partial={partial(15, 11)} home="A" away="B" />);
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
    expect(container.querySelector("[data-cambiato]")).toHaveTextContent("15");
  });

  it("offline: dice da quando è fermo", () => {
    media = mockMatchMedia(true);
    const { container } = render(
      <PunteggioParziale
        partial={partial(14, 11)}
        home="A"
        away="B"
        offline
        freshAt="2027-06-12T08:45:00.000Z"
      />,
    );
    expect(container).toHaveTextContent("Parziale · fermo");
    expect(container).toHaveTextContent(
      "Connessione persa: parziale fermo alle 10:45",
    );
  });
});
