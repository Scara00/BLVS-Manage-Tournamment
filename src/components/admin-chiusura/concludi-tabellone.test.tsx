import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ConcludiTabelloneAction } from "@/lib/tappe/chiusura/state";
import { ConcludiTabellone } from "./concludi-tabellone";

beforeAll(() => {
  // jsdom has no layout: the outcome message scrolls itself into view.
  Element.prototype.scrollIntoView ??= vi.fn();
});

function renderConcludi(action: ConcludiTabelloneAction) {
  return render(
    <ConcludiTabellone
      tappaId="t1"
      tappaNome="Tappa 1 · Jesolo"
      categoria="M"
      action={action}
    />,
  );
}

async function apri(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: "Concludi tabellone" }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("alertdialog", {
    name: "Concludere il tabellone maschile?",
  });
}

describe("ConcludiTabellone", () => {
  it("si apre da tastiera con il focus sull'azione sicura e spiega l'effetto", async () => {
    const user = userEvent.setup();
    renderConcludi(vi.fn());
    const dialog = await apri(user);
    expect(dialog).toHaveAccessibleDescription(
      "Tappa 1 · Jesolo. I punti diventano definitivi e la classifica generale si aggiorna.",
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Non concludere" }),
      ).toHaveFocus(),
    );
  });

  it("conferma, chiude il dialog e sposta il focus sull'esito", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ConcludiTabelloneAction>(async () => ({
      status: "success",
      message: "Tabellone maschile concluso: i punti sono definitivi.",
      tappaConclusa: false,
      at: 1,
    }));
    renderConcludi(action);
    const dialog = await apri(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Sì, concludi il tabellone" }),
    );
    const esito = await screen.findByText(
      "Tabellone maschile concluso: i punti sono definitivi.",
    );
    await waitFor(() => expect(esito).toHaveFocus());
    const data = action.mock.calls[0][1];
    expect(data.get("tappaId")).toBe("t1");
    expect(data.get("categoria")).toBe("m");
  });

  it("mostra il rifiuto del server con il link per risolvere la parità", async () => {
    const user = userEvent.setup();
    renderConcludi(async () => ({
      status: "error",
      reason: "bloccato",
      message:
        "Non si può concludere: c'è una parità da risolvere (Finale gold).",
      link: { href: "#girone-live-g1", label: "Risolvi parità" },
      at: 1,
    }));
    const dialog = await apri(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Sì, concludi il tabellone" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "parità da risolvere (Finale gold)",
    );
    expect(
      within(dialog).getByRole("link", { name: "Risolvi parità" }),
    ).toHaveAttribute("href", "#girone-live-g1");
  });
});
