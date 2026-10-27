import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { AvvioFaseAction } from "@/lib/tappe/avvio/state";
import { AvvioFase } from "./avvio-fase";
import { avviata, bloccata, erroriServer, pronta } from "./stories-data";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const AVVIA_PRONTA = "Avvia le 9 partite";
const AVVIA_BLOCCATA = `Avvia le ${bloccata.riepilogo.partite} partite`;

function renderAvvio(
  props: Partial<Parameters<typeof AvvioFase>[0]> & {
    action: AvvioFaseAction;
  },
) {
  return render(
    <ToastProvider>
      <AvvioFase view={pronta} {...props} />
      <Toaster />
    </ToastProvider>,
  );
}

describe("AvvioFase (w-admin-avvio-fase)", () => {
  it("riassume gironi, giocatori e partite e mostra i 3 controlli", () => {
    renderAvvio({ action: vi.fn() });
    const riepilogo = screen.getByLabelText("Riepilogo");
    expect(riepilogo).toHaveTextContent("Gironi3");
    expect(riepilogo).toHaveTextContent("Giocatori nei gironi12");
    expect(riepilogo).toHaveTextContent("Partite da creare9");
    const controlli = within(screen.getByRole("list", { name: "Controlli" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(controlli).toEqual([
      "Gironi da 4Superato",
      "Nessun doppioneSuperato",
      "Tutti gli iscritti assegnatiSuperato",
    ]);
  });

  it("mostra l'anteprima con lettere e cognomi", () => {
    renderAvvio({ action: vi.fn() });
    const partite = screen.getByRole("list", { name: "Partite del Girone A" });
    const [primo] = within(partite).getAllByRole("listitem");
    expect(primo).toHaveTextContent(
      "Turno 1AA, RossieBB, BianchicontroCC, MarinoeDD, Greco",
    );
  });

  it("conferma e avvia: toast, poi la gestione live del tabellone", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AvvioFaseAction>(async () => ({
      status: "success",
      partite: 9,
      message:
        "Gironi iniziali avviati per il tabellone maschile: 9 partite create.",
      at: 1,
    }));
    const { rerender } = renderAvvio({ action });

    await user.click(screen.getByRole("button", { name: AVVIA_PRONTA }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Avviare i gironi iniziali del tabellone maschile?",
    });
    expect(dialog).toHaveAccessibleDescription(
      /9 partite da giocare per 3 gironi/,
    );
    await user.click(within(dialog).getByRole("button", { name: "Avvia" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("tappaId")).toBe("cagliari");
    expect(data.get("categoria")).toBe("m");
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/admin/tappe/cagliari/live/m"),
    );

    // The page refreshes with the started board.
    rerender(
      <ToastProvider>
        <AvvioFase view={avviata} action={action} />
        <Toaster />
      </ToastProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("fase-avviata")).toHaveFocus(),
    );
    expect(await screen.findByText(/9 partite create/)).toBeInTheDocument();
  });

  it("con problemi elenca gli errori con il link al girone", () => {
    renderAvvio({ view: bloccata, action: vi.fn() });
    const errori = screen.getByRole("region", {
      name: "2 problemi da correggere",
    });
    const link = within(errori).getByRole("link", { name: "Vai al Girone C" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/tappe/cagliari/gironi/m#girone-g3",
    );
    expect(
      within(errori).getByRole("link", { name: "Vai ai gironi" }),
    ).toHaveAttribute("href", "/admin/tappe/cagliari/gironi/m#non-assegnati");
    expect(errori).toHaveTextContent(
      "Errore: Girone C: ha 3 giocatori invece di 4.",
    );
  });

  it("annuncia il rifiuto del server e sposta il fuoco sugli errori", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AvvioFaseAction>(async () => ({
      status: "fieldErrors",
      errori: erroriServer,
      message: "La fase non è partita: correggi i gironi indicati e riprova.",
      at: 1,
    }));
    renderAvvio({ view: bloccata, action });
    await user.click(screen.getByRole("button", { name: AVVIA_BLOCCATA }));

    await waitFor(() =>
      expect(screen.getByTestId("avvio-annuncio")).toHaveTextContent(
        "La fase non è partita: correggi i gironi indicati e riprova. 2 errori.",
      ),
    );
    expect(screen.getByTestId("avvio-annuncio")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(
      screen.getByRole("heading", { name: "2 problemi da correggere" }),
    ).toHaveFocus();
  });

  it("offline non avvia e spiega perché", () => {
    renderAvvio({ action: vi.fn(), offline: true });
    const button = screen.getByRole("button", { name: AVVIA_PRONTA });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(/Sei offline/);
  });
});
