import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { SalvaPunteggioAction } from "@/lib/punteggi/state";
import { InserimentoPunteggio } from "./inserimento-punteggio";
import {
  annullaFinto,
  correzione,
  salvaConImpatto,
  salvaSenzaRete,
} from "./stories-data";

function renderCorrezione(salva: SalvaPunteggioAction = salvaConImpatto) {
  return render(
    <ToastProvider>
      <InserimentoPunteggio
        scheda={correzione}
        salva={salva}
        annulla={annullaFinto}
        verificaIniziale
      />
      <Toaster />
    </ToastProvider>,
  );
}

const campoB = () => screen.getByRole("textbox", { name: /Conti\/Gallo/ });

async function scrivi(
  user: ReturnType<typeof userEvent.setup>,
  a: string,
  b: string,
) {
  const campoA = screen.getByRole("textbox", { name: /Rinaldi\/Moretti/ });
  await user.clear(campoA);
  if (a) await user.type(campoA, a);
  await user.clear(campoB());
  if (b) await user.type(campoB(), b);
}

async function alDialog(user: ReturnType<typeof userEvent.setup>) {
  await scrivi(user, "10", "21");
  await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));
  await user.click(screen.getByRole("button", { name: "Conferma e salva" }));
  return screen.findByRole("alertdialog", {
    name: "La fase successiva è già generata",
  });
}

describe("correzione (w-admin-correzione)", () => {
  it("vecchio valore barrato e nuovo, «Cosa cambia» segue i valori", async () => {
    const user = userEvent.setup();
    renderCorrezione();
    const sezione = within(screen.getAllByTestId("cosa-cambia")[0]);
    expect(sezione.getByTestId("valore-precedente").tagName).toBe("DEL");
    expect(sezione.getByTestId("valore-precedente")).toHaveTextContent("21–18");
    expect(sezione.getAllByRole("listitem")[0]).toHaveTextContent(
      /uguale a quello salvato/,
    );

    await scrivi(user, "10", "21");
    expect(sezione.getByTestId("valore-nuovo")).toHaveTextContent("10–21");
    const voci = sezione.getAllByRole("listitem").map((li) => li.textContent);
    expect(voci).toContain(
      "·Il vincitore cambia: ora vince Conti/Gallo, non più Rinaldi/Moretti.",
    );
    expect(voci.some((v) => v?.includes("dal 4° al 2° posto"))).toBe(true);
  });

  it("«non chiude il set» è scritto e annunciato", async () => {
    const user = userEvent.setup();
    renderCorrezione();
    await scrivi(user, "21", "20");
    const sezione = within(screen.getAllByTestId("cosa-cambia")[0]);
    expect(sezione.getAllByRole("listitem")[0]).toHaveTextContent(
      /21–20 non chiude il set/,
    );
    await waitFor(() =>
      expect(screen.getByTestId("annuncio-cosa-cambia")).toHaveTextContent(
        /non chiude il set/,
      ),
    );
  });

  it("il riepilogo mostra il confronto e cosa cambia", async () => {
    const user = userEvent.setup();
    renderCorrezione();
    await scrivi(user, "10", "21");
    await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));
    const riepilogo = within(screen.getByTestId("riepilogo-punteggio"));
    expect(riepilogo.getByTestId("valore-precedente")).toHaveTextContent(
      "21–18",
    );
    expect(
      riepilogo
        .getAllByRole("listitem")
        .some((li) => li.textContent?.includes("Il vincitore cambia")),
    ).toBe(true);
  });

  it("fase successiva: anteprima, punteggi persi e «Rigenera» senza spunta", async () => {
    const user = userEvent.setup();
    renderCorrezione();
    const dialog = within(await alDialog(user));
    expect(dialog.getByTestId("anteprima-fase").children).toHaveLength(2);
    expect(dialog.getByTestId("punteggi-persi")).toHaveTextContent(
      "Rigenerando perdi 1 punteggio già inserito.",
    );
    const card = within(dialog.getByTestId("card-rigenera"));
    const casella = card.getByRole("checkbox");

    await user.click(dialog.getByRole("button", { name: "Rigenera" }));
    expect(
      card.getByText(/Spunta la casella per confermare che perdi 1 punteggio/),
    ).toBeInTheDocument();
    await waitFor(() => expect(casella).toHaveFocus());
    expect(casella).toHaveAttribute("aria-invalid", "true");

    await user.keyboard(" ");
    await user.click(dialog.getByRole("button", { name: "Rigenera" }));
    expect(await screen.findByTestId("esito-punteggio")).toHaveTextContent(
      /Punteggio corretto: .*La fase successiva è stata eliminata.*perso 1 punteggio/,
    );
  });

  it("«Mantieni» salva e lascia la fase successiva", async () => {
    const user = userEvent.setup();
    const salva = vi.fn(salvaConImpatto);
    renderCorrezione(salva);
    const dialog = within(await alDialog(user));
    await user.click(dialog.getByRole("button", { name: "Mantieni" }));
    expect(await screen.findByTestId("esito-punteggio")).toHaveTextContent(
      "La fase successiva resta com'era.",
    );
    const inviato = salva.mock.calls.at(-1)![1];
    expect(inviato.get("scelta")).toBe("mantieni");
    expect(inviato.get("attesi")).toBe("1");
    expect(inviato.get("versione")).toBe("2");
  });

  it("senza rete l'errore resta nel dialog", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let primo = true;
    const salva: SalvaPunteggioAction = async (prev, data) => {
      if (primo) {
        primo = false;
        return salvaConImpatto(prev, data);
      }
      return salvaSenzaRete(prev, data);
    };
    renderCorrezione(salva);
    const dialog = within(await alDialog(user));
    await user.click(dialog.getByRole("button", { name: "Mantieni" }));
    expect(await dialog.findByTestId("errore-impatto")).toHaveTextContent(
      /controlla la connessione/,
    );
  });
});
