import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PunteggioUfficiale } from "@/lib/punteggi/conflitto/rileva";
import { ConflittoPunteggio } from "./conflitto-punteggio";

const salvato: PunteggioUfficiale = {
  versione: 3,
  sets: [{ a: 21, b: 18 }],
  autore: "Giulia Neri",
  salvatoIl: "2026-06-12T12:05:00Z",
};

function Harness({
  onTieni = vi.fn(),
  onSovrascrivi = vi.fn(),
  ufficiale = salvato,
}: {
  onTieni?: () => void;
  onSovrascrivi?: (v: number) => void;
  ufficiale?: PunteggioUfficiale;
}) {
  const [open, setOpen] = useState(true);
  return (
    <ConflittoPunteggio
      open={open}
      onOpenChange={setOpen}
      salvato={ufficiale}
      mio={[{ a: 21, b: 19 }]}
      coppie={{ a: "Rossi/Bianchi", b: "Verdi/Moretti" }}
      onTieniSalvato={onTieni}
      onSovrascrivi={onSovrascrivi}
    />
  );
}

describe("ConflittoPunteggio (w-admin-conflitto)", () => {
  it("mostra il salvato (ufficiale) e il tuo, con la cifra diversa segnata", async () => {
    render(<Harness />);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Il punteggio è cambiato",
    });
    expect(dialog).toHaveTextContent("Giulia Neri");
    expect(dialog).toHaveTextContent("alle 14:05");

    const ufficiale = within(dialog).getByRole("group", { name: /Salvato/ });
    expect(ufficiale).toHaveTextContent("Ufficiale");
    expect(ufficiale).toHaveTextContent("set 1: 21 a 18");
    const mio = within(dialog).getByRole("group", { name: "Il tuo" });
    expect(mio).toHaveTextContent("set 1: 21 a 19");

    // Marked by more than colour: an underline and a sentence.
    const diverse = dialog.querySelectorAll("[data-diverso]");
    expect([...diverse].map((n) => n.textContent)).toEqual(["18", "19"]);
    expect(diverse[0].className).toContain("underline");
    expect(
      within(dialog).getByTestId("conflitto-differenze"),
    ).toHaveTextContent("Set 1, Verdi/Moretti: salvato 18, tuo 19");
  });

  it("«Tieni il salvato» ha il focus e chiude senza sovrascrivere", async () => {
    const user = userEvent.setup();
    const onTieni = vi.fn();
    const onSovrascrivi = vi.fn();
    render(<Harness onTieni={onTieni} onSovrascrivi={onSovrascrivi} />);
    const tieni = await screen.findByRole("button", {
      name: "Tieni il salvato",
    });
    await waitFor(() => expect(tieni).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onTieni).toHaveBeenCalledTimes(1);
    expect(onSovrascrivi).not.toHaveBeenCalled();
  });

  it("«Sovrascrivi» chiede conferma e sovrascrive solo la versione mostrata", async () => {
    const user = userEvent.setup();
    const onSovrascrivi = vi.fn();
    render(<Harness onSovrascrivi={onSovrascrivi} />);

    await user.click(
      await screen.findByRole("button", { name: "Sovrascrivi" }),
    );
    // No overwrite yet: a second, explicit confirmation is needed.
    expect(onSovrascrivi).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: "Sovrascrivere il punteggio ufficiale?",
      }),
    ).toHaveTextContent(
      "Il punteggio salvato 21-18 viene sostituito dal tuo 21-19",
    );
    expect(screen.getByRole("button", { name: "Annulla" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(onSovrascrivi).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sovrascrivi" })).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Sì, sovrascrivi" }));
    expect(onSovrascrivi).toHaveBeenCalledWith(3);
  });

  it("un nuovo conflitto riporta alla scelta con il valore aggiornato", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    await user.click(
      await screen.findByRole("button", { name: "Sovrascrivi" }),
    );
    rerender(
      <Harness
        ufficiale={{ ...salvato, versione: 4, sets: [{ a: 22, b: 20 }] }}
      />,
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Il punteggio è cambiato",
    });
    expect(
      within(dialog).getByRole("group", { name: /Salvato/ }),
    ).toHaveTextContent("set 1: 22 a 20");
  });
});
