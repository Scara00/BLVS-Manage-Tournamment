import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodaPunteggiView, PunteggiNonInviati } from "./coda-punteggi-view";
import { StatoInvio } from "./stato-invio";
import { CODA_MISTA, voceDiProva } from "./stories-fixtures";

describe("StatoInvio", () => {
  it("dice lo stato a parole", () => {
    render(
      <>
        <StatoInvio stato="in_attesa" />
        <StatoInvio stato="salvato" />
        <StatoInvio stato="sessione_chiusa" />
      </>,
    );
    expect(screen.getByText("In attesa di invio")).toBeInTheDocument();
    expect(screen.getByText("Salvato")).toBeInTheDocument();
    expect(
      screen.getByText("Salvato qui, non ancora inviato"),
    ).toBeInTheDocument();
  });
});

describe("CodaPunteggiView", () => {
  it("non mostra nulla con la coda vuota", () => {
    const { container } = render(<CodaPunteggiView voci={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("riassume la coda e fa scegliere in caso di conflitto", async () => {
    const onTieniIlMio = vi.fn();
    const onTieniQuelloSalvato = vi.fn();
    render(
      <CodaPunteggiView
        voci={CODA_MISTA}
        onTieniIlMio={onTieniIlMio}
        onTieniQuelloSalvato={onTieniQuelloSalvato}
      />,
    );
    const sezione = screen.getByRole("region", {
      name: "Punteggi su questo dispositivo",
    });
    expect(sezione).toHaveTextContent(
      "1 punteggio in attesa di invio, 1 punteggio da verificare",
    );
    const lista = within(sezione).getByRole("list", {
      name: "Punteggi in coda",
    });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /Tieni il mio/ }));
    expect(onTieniIlMio).toHaveBeenCalledWith(CODA_MISTA[2].chiave);
    await userEvent.click(
      screen.getByRole("button", { name: /Tieni quello salvato 21–17/ }),
    );
    expect(onTieniQuelloSalvato).toHaveBeenCalledWith(CODA_MISTA[2].chiave);
  });
});

describe("PunteggiNonInviati (w-admin-sessione)", () => {
  it("elenca solo quelli non inviati, come salvati qui", () => {
    render(
      <PunteggiNonInviati
        voci={[voceDiProva(), voceDiProva({ stato: "salvato", chiave: "x" })]}
      />,
    );
    const lista = screen.getByRole("list", {
      name: "Punteggi non ancora inviati",
    });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1);
    expect(lista).toHaveTextContent("Salvato qui, non ancora inviato");
  });

  it("dice quando non c'è nulla in attesa", () => {
    render(<PunteggiNonInviati voci={[]} />);
    expect(
      screen.getByText("Nessun punteggio in attesa su questo dispositivo."),
    ).toBeInTheDocument();
  });
});
