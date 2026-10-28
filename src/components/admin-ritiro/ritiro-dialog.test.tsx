import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RitiroAction, RitiroState } from "@/lib/ritiri/types";
import { RitiroDialog } from "./ritiro-dialog";
import { girone, impattoFase, partiteGirone } from "./stories-data";

function renderDialog(action: RitiroAction, onEsito = vi.fn()) {
  render(
    <RitiroDialog
      tappaId="jesolo"
      categoria="M"
      girone={girone}
      partite={partiteGirone}
      assenze={[]}
      action={action}
      online
      onEsito={onEsito}
    />,
  );
  return onEsito;
}

async function apri(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "Ritiro o assenza: Girone A" }),
  );
  return screen.findByRole("dialog");
}

describe("RitiroDialog (w-admin-ritiro)", () => {
  it("mostra la regola e l'anteprima, poi registra le partite scelte", async () => {
    const user = userEvent.setup();
    const ricevuti: FormData[] = [];
    const action: RitiroAction = async (_prev, fd) => {
      ricevuti.push(fd);
      return {
        status: "success",
        message: "Ritiro registrato",
        scelta: null,
        punteggiPersi: 0,
        at: 1,
      };
    };
    const onEsito = renderDialog(action);
    const dialog = await apri(user);

    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: /Giocatore/ }),
      "i-Rossi",
    );
    await user.click(within(dialog).getByRole("radio", { name: /Ritiro/ }));
    // A withdrawal ticks the matches still to play.
    expect(
      within(dialog).getByRole("checkbox", { name: /turno 2/ }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: /turno 1/ }),
    ).not.toBeChecked();
    expect(within(dialog).getByTestId("ritiro-regola")).toHaveTextContent(
      /annullata/,
    );
    expect(within(dialog).getByTestId("ritiro-anteprima")).toHaveTextContent(
      /turno 2:\s*prima da giocare\s*→\s*dopo annullata/,
    );
    expect(within(dialog).getByTestId("ritiro-classifica")).toHaveTextContent(
      "Rossi Luca (ritirato)",
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: "Registra il ritiro (2 partite)",
      }),
    );
    await waitFor(() => expect(onEsito).toHaveBeenCalled());
    const fd = ricevuti[0];
    expect(fd.get("iscrizioneId")).toBe("i-Rossi");
    expect(fd.get("tipo")).toBe("ritiro");
    expect(fd.getAll("partita")).toEqual(["g1-t2:1", "g1-t3:1"]);
    expect(fd.get("categoria")).toBe("m");
  });

  it("mostra gli errori accanto ai campi e porta il focus sul primo", async () => {
    const user = userEvent.setup();
    const action: RitiroAction = async () => ({
      status: "fieldErrors",
      errori: {
        giocatore: "Scegli il giocatore.",
        partite: "Scegli almeno una partita.",
      },
      at: 1,
    });
    renderDialog(action);
    const dialog = await apri(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Registra ritiro o assenza" }),
    );
    const giocatore = within(dialog).getByRole("combobox", {
      name: /Giocatore/,
    });
    await waitFor(() => expect(giocatore).toHaveFocus());
    expect(giocatore).toHaveAttribute("aria-invalid", "true");
    expect(giocatore).toHaveAccessibleDescription(/Scegli il giocatore\./);
    expect(within(dialog).getByTestId("ritiro-partite")).toHaveTextContent(
      "Scegli almeno una partita.",
    );
  });

  it("con la fase successiva apre il dialog di impatto e rimanda la scelta", async () => {
    const user = userEvent.setup();
    const ricevuti: FormData[] = [];
    const action: RitiroAction = async (prev, fd) => {
      ricevuti.push(fd);
      const at = prev.status === "idle" ? 1 : prev.at + 1;
      if (!fd.get("scelta")) {
        return {
          status: "impatto",
          impatto: impattoFase,
          erroreConferma: null,
          avviso: null,
          at,
        } satisfies RitiroState;
      }
      return {
        status: "success",
        message: "Assenza registrata",
        scelta: "mantieni",
        punteggiPersi: 0,
        at,
      };
    };
    const onEsito = renderDialog(action);
    const dialog = await apri(user);
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: /Giocatore/ }),
      "i-Rossi",
    );
    await user.click(within(dialog).getByRole("radio", { name: /Assenza/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /turno 1/ }));
    await user.click(
      within(dialog).getByRole("button", {
        name: "Registra l'assenza (1 partita)",
      }),
    );

    const impatto = await screen.findByRole("alertdialog");
    expect(impatto).toHaveTextContent("La fase successiva è già generata");
    expect(impatto).toHaveTextContent("dopo l'assenza");
    expect(impatto).toHaveTextContent("Gold A · turno 1");
    await user.click(within(impatto).getByRole("button", { name: "Mantieni" }));

    await waitFor(() => expect(onEsito).toHaveBeenCalled());
    expect(ricevuti[1].get("scelta")).toBe("mantieni");
    expect(ricevuti[1].get("attesi")).toBe("1");
    expect(ricevuti[1].getAll("partita")).toEqual(["g1-t1:2"]);
  });
});
