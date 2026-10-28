import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ImpattoFase as ImpattoFaseValore } from "@/lib/punteggi/correzione/types";
import { ImpattoFase } from "./impatto-fase";

const impatto: ImpattoFaseValore = {
  partite: [
    {
      id: "f1",
      fase: "finale",
      turno: 1,
      stato: "conclusa",
      sets: [{ a: 21, b: 18 }],
      squadre: {
        a: ["Luca Rossi", "Marco Bianchi"],
        b: ["Paolo Greco", "Andrea Costa"],
      },
    },
  ],
  punteggiPersi: 1,
  tabelloneConcluso: true,
};

describe("ImpattoFase su tabellone concluso (BLVS-43)", () => {
  it("offre solo «Mantieni» con conferma esplicita e dice che nessun punto cambia", async () => {
    const user = userEvent.setup();
    const onScegli = vi.fn();
    render(
      <ImpattoFase
        open
        onOpenChange={() => {}}
        impatto={impatto}
        pending={false}
        online
        onScegli={onScegli}
      />,
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Il tabellone è concluso",
    });
    expect(
      within(dialog).queryByRole("button", { name: "Rigenera" }),
    ).toBeNull();
    expect(within(dialog).getByTestId("punti-che-cambiano")).toHaveTextContent(
      "Punti che cambiano: nessuno.",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Sì, correggi e mantieni" }),
    );
    expect(onScegli).toHaveBeenCalledWith("mantieni", true);
  });
});
