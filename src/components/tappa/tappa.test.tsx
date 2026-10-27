import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PRENDI_POSTO_INITIAL } from "@/lib/iscrizioni/prendi-posto-state";
import { CONFERMATA, dettaglio } from "./fixtures";
import type { PrendiPostoAction } from "./prendi-posto-form";
import { IscrizioneConfermataView } from "./iscrizione-confermata";
import { TappaDettaglioView } from "./tappa-dettaglio";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

const noop = async () => PRENDI_POSTO_INITIAL;

function bottone() {
  return screen.getByRole("button", { name: /^Prendi/ });
}

describe("TappaDettaglioView", () => {
  it("mostra i due tabelloni con stato e posti e il proprio evidenziato", () => {
    render(<TappaDettaglioView tappa={dettaglio("aperta")} action={noop} />);
    const m = screen.getByRole("region", { name: /Maschile/ });
    const f = screen.getByRole("region", { name: /Femminile/ });
    expect(within(m).getByText("5 liberi su 16")).toBeInTheDocument();
    expect(within(m).getByText("La tua categoria")).toBeInTheDocument();
    expect(within(f).getByText("5 liberi su 12")).toBeInTheDocument();
    expect(within(f).queryByText("La tua categoria")).toBeNull();
    expect(screen.getByText(/Sabato 26: accrediti/)).toBeInTheDocument();
  });

  it("iscrizioni aperte: «Prendi il posto 12 nel maschile» attivo", () => {
    render(<TappaDettaglioView tappa={dettaglio("aperta")} action={noop} />);
    expect(bottone()).toHaveAccessibleName("Prendi il posto 12 nel maschile");
    expect(bottone()).not.toHaveAttribute("aria-disabled", "true");
    expect(bottone()).not.toHaveAttribute("aria-describedby");
  });

  it.each([
    ["chiusa", /iscrizioni a questa tappa sono chiuse/],
    ["scaduta", /scadute il 19 giugno/],
    ["esaurita", /Posti esauriti/],
    ["annullata", /annullata/],
    ["giaIscritto", /Sei già iscritto/],
    ["senzaCategoria", /Indica la tua categoria/],
  ] as const)(
    "%s: pulsante disattivato con il motivo collegato",
    (stato, motivo) => {
      render(<TappaDettaglioView tappa={dettaglio(stato)} action={noop} />);
      expect(bottone()).toHaveAttribute("aria-disabled", "true");
      expect(bottone()).toHaveAccessibleDescription(motivo);
    },
  );

  it("se il server rifiuta, mostra il messaggio e lo collega al pulsante", async () => {
    const action = vi.fn<PrendiPostoAction>(async () => ({
      status: "error" as const,
      message: "Posti esauriti: qualcuno ha preso l'ultimo posto prima di te.",
      attempt: 1,
    }));
    render(<TappaDettaglioView tappa={dettaglio("aperta")} action={action} />);
    await userEvent.click(bottone());
    const alert = await screen.findByText(/qualcuno ha preso l'ultimo posto/);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(bottone()).toHaveAccessibleDescription(/ultimo posto/);
    expect(action.mock.calls[0][1].get("tappaId")).toBe("rimini");
  });
});

describe("IscrizioneConfermataView", () => {
  it("mostra posto, data, luogo, ritrovo e scadenza per annullare", () => {
    render(<IscrizioneConfermataView iscrizione={CONFERMATA} />);
    const riepilogo = screen.getByLabelText("Riepilogo dell'iscrizione");
    for (const [label, value] of [
      ["Posto", /12 · Maschile/],
      ["Data", /26–27 giugno/],
      ["Luogo", /Rimini, Bagno 26/],
      ["Ritrovo", /Bagno 26, ingresso dal lungomare/],
      ["Annulla entro", /21 giugno/],
    ] as const) {
      const term = within(riepilogo).getByText(label);
      expect(term.nextElementSibling?.textContent).toMatch(value);
    }
  });

  it("porta il focus sul titolo e annuncia la conferma", async () => {
    render(<IscrizioneConfermataView iscrizione={CONFERMATA} />);
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent("Sei iscritto: posto 12 nel maschile");
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Iscrizione confermata: posto 12 nel maschile, Tappa 2 · Rimini.",
    );
  });
});
