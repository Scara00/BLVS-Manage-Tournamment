import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AnnullaIscrizioneAction } from "@/lib/iscrizioni/annullamento/state";
import { ToastProvider } from "@/components/ui/toast";
import { annullamentoRimini, elenco } from "./fixtures";
import { AnnullaIscrizione } from "./annulla-iscrizione";
import { MieIscrizioni } from "./mie-iscrizioni";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: ToastProvider });
}

const idle: AnnullaIscrizioneAction = async () => ({ status: "idle" });

function card(nome: RegExp) {
  return screen
    .getAllByTestId("iscrizione-mia")
    .find((el) => nome.test(el.textContent ?? "")) as HTMLElement;
}

describe("MieIscrizioni", () => {
  it("separa prossime e passate, con stato a testo, posto e risultato", () => {
    render(<MieIscrizioni vista={elenco("completo")} action={idle} />);
    const prossime = screen.getByRole("region", { name: "Prossime tappe" });
    const passate = screen.getByRole("region", { name: "Tappe passate" });
    expect(within(prossime).getAllByTestId("iscrizione-mia")).toHaveLength(3);
    expect(within(passate).getAllByTestId("iscrizione-mia")).toHaveLength(2);

    const rimini = card(/Rimini/);
    expect(within(rimini).getByText("Iscritto")).toBeInTheDocument();
    expect(within(rimini).getByTestId("posto")).toHaveTextContent(
      "12 · Maschile",
    );
    expect(
      within(card(/Pescara/)).getByText("Iscrizione annullata"),
    ).toBeInTheDocument();
    expect(within(card(/Jesolo/)).getByTestId("risultato")).toHaveTextContent(
      "2° posto · 8 punti (provvisori)",
    );
  });

  it("riepilogo della stagione dalla classifica generale", () => {
    render(<MieIscrizioni vista={elenco("completo")} action={idle} />);
    const stagione = screen.getByRole("region", {
      name: "La tua stagione 2027",
    });
    expect(within(stagione).getByTestId("stagione-punti")).toHaveTextContent(
      "12",
    );
    expect(within(stagione).getByTestId("stagione-tappe")).toHaveTextContent(
      "2",
    );
    expect(
      within(stagione).getByTestId("stagione-posizione"),
    ).toHaveTextContent("2° su 2");
    expect(within(stagione).getByText("Punti provvisori")).toBeInTheDocument();
  });

  it("dopo la scadenza l'azione non c'è e un testo spiega perché", () => {
    render(<MieIscrizioni vista={elenco("completo")} action={idle} />);
    const cagliari = card(/Cagliari/);
    expect(within(cagliari).queryByRole("button")).toBeNull();
    expect(
      within(cagliari).getByTestId("annullamento-non-possibile"),
    ).toHaveTextContent(/scadenza era il 29 maggio/);
    expect(
      within(card(/Rimini/)).getByRole("button", {
        name: "Annulla l'iscrizione",
      }),
    ).toHaveAccessibleDescription(/Rimini.*fino al 21 giugno/);
  });

  it("il dialog parte da «Mantieni l'iscrizione» ed elenca le conseguenze", async () => {
    const user = userEvent.setup();
    render(<MieIscrizioni vista={elenco("completo")} action={idle} />);
    const apri = within(card(/Rimini/)).getByRole("button", {
      name: "Annulla l'iscrizione",
    });
    await user.click(apri);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName(
      "Annullare l'iscrizione a Tappa 2 · Rimini?",
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Mantieni l'iscrizione" }),
      ).toHaveFocus(),
    );
    expect(within(dialog).getByTestId("annulla-conseguenze")).toHaveTextContent(
      "Il posto 12 nel maschile torna libero",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(apri).toHaveFocus());
  });

  it("conferma: chiama l'azione e mette il focus sul messaggio di esito", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AnnullaIscrizioneAction>(async () => ({
      status: "success" as const,
      tappaId: "rimini",
      posto: 12,
      message:
        "Iscrizione a Tappa 2 · Rimini annullata: il posto 12 è di nuovo libero.",
      attempt: 1,
    }));
    render(<MieIscrizioni vista={elenco("completo")} action={action} />);
    await user.click(
      within(card(/Rimini/)).getByRole("button", {
        name: "Annulla l'iscrizione",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Annulla l'iscrizione" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const form = action.mock.calls[0][1];
    expect(form.get("iscrizioneId")).toBe(annullamentoRimini().iscrizioneId);
    const esito = screen.getByTestId("esito-annullamento");
    await waitFor(() =>
      expect(esito).toHaveTextContent("il posto 12 è di nuovo libero"),
    );
    await waitFor(() => expect(esito).toHaveFocus());
  });

  it("un rifiuto del server resta nel dialog", async () => {
    const user = userEvent.setup();
    const action: AnnullaIscrizioneAction = async () => ({
      status: "error",
      reason: "refused",
      message: "Non puoi più annullare: la scadenza era il 21 giugno, 23:59.",
      attempt: 1,
    });
    render(<MieIscrizioni vista={elenco("completo")} action={action} />);
    await user.click(
      within(card(/Rimini/)).getByRole("button", {
        name: "Annulla l'iscrizione",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Annulla l'iscrizione" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /scadenza era il 21 giugno/,
    );
  });

  it("senza iscrizioni invita a scegliere una tappa", () => {
    render(<MieIscrizioni vista={elenco("vuoto")} action={idle} />);
    expect(
      screen.getByRole("link", { name: "Scegli una tappa" }),
    ).toHaveAttribute("href", "/tappe");
  });
});

describe("AnnullaIscrizione (w-tappa, w-iscrizione-ok)", () => {
  it("dopo un annullamento va dove indicato", async () => {
    const user = userEvent.setup();
    const action: AnnullaIscrizioneAction = async () => ({
      status: "success",
      tappaId: "rimini",
      posto: 12,
      message: "fatto",
      attempt: 1,
    });
    render(
      <AnnullaIscrizione
        annullamento={annullamentoRimini()}
        action={action}
        ritorno="/tappe/rimini/iscrizione"
        dopo="/tappe/rimini"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Annulla l'iscrizione" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Annulla l'iscrizione" }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/tappe/rimini"));
  });
});
