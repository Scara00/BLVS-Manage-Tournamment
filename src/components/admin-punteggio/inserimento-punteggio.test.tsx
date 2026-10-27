import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type {
  AnnullaPunteggioAction,
  SalvaPunteggioAction,
} from "@/lib/punteggi/state";
import { InserimentoPunteggio } from "./inserimento-punteggio";
import { passo } from "./riga-squadra";
import {
  annullaFinto,
  daInserire,
  giaSalvata,
  salvaFinto,
} from "./stories-data";

function renderScheda(
  props: Partial<Parameters<typeof InserimentoPunteggio>[0]> = {},
) {
  return render(
    <ToastProvider>
      <InserimentoPunteggio
        scheda={daInserire}
        salva={salvaFinto}
        annulla={annullaFinto}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
}

const campoA = () => screen.getByRole("textbox", { name: /Rinaldi\/Moretti/ });
const campoB = () => screen.getByRole("textbox", { name: /Conti\/Gallo/ });

describe("passo dei pulsanti −/+", () => {
  it("parte da 0 e resta tra 0 e 99", () => {
    expect(passo("", 1)).toBe("1");
    expect(passo("", -1)).toBe("0");
    expect(passo("abc", 1)).toBe("1");
    expect(passo("20", 1)).toBe("21");
    expect(passo("99", 1)).toBe("99");
  });
});

describe("InserimentoPunteggio (w-admin-punteggio)", () => {
  it("due righe con le coppie, campi numerici e pulsanti etichettati", async () => {
    const user = userEvent.setup();
    renderScheda();
    expect(campoA()).toHaveAttribute("inputmode", "numeric");
    expect(campoB()).toHaveAttribute("inputmode", "numeric");

    await user.click(
      screen.getByRole("button", {
        name: "Aggiungi un punto a Rinaldi/Moretti",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Aggiungi un punto a Rinaldi/Moretti",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Togli un punto a Rinaldi/Moretti" }),
    );
    expect(campoA()).toHaveValue("1");
    expect(
      screen.getByRole("button", { name: "Aggiungi un punto a Conti/Gallo" }),
    ).toBeInTheDocument();
  });

  it("mostra gli esiti ✓ ! · a testo accanto ai campi", () => {
    const { unmount } = renderScheda({
      initialValori: { a: "21", b: "19" },
      verificaIniziale: true,
    });
    const esiti = () =>
      document.querySelectorAll<HTMLElement>("[data-slot=esito]");
    expect([...esiti()].map((e) => e.textContent)).toEqual([
      "✓valido",
      "✓valido",
    ]);
    unmount();

    renderScheda({
      initialValori: { a: "21", b: "21" },
      verificaIniziale: true,
    });
    expect([...esiti()].map((e) => e.textContent)).toEqual([
      "!da correggere",
      "!da correggere",
    ]);
    expect(screen.getByTestId("errore-set")).toHaveTextContent(
      "Il pareggio non è ammesso",
    );
    expect(campoA()).toHaveAttribute("aria-invalid", "true");
    expect(campoA().getAttribute("aria-describedby")).toContain(
      screen.getByTestId("errore-set").id,
    );
  });

  it("un riepilogo non valido annuncia gli errori e porta il fuoco al campo", async () => {
    const user = userEvent.setup();
    renderScheda();
    await user.type(campoA(), "21");
    await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));
    expect(screen.getByTestId("annuncio-punteggio")).toHaveTextContent(
      "Inserisci i punti.",
    );
    await waitFor(() => expect(campoB()).toHaveFocus());
    expect(screen.queryByTestId("riepilogo-punteggio")).toBeNull();
  });

  it("riepilogo, Conferma e salva, poi Annulla nel toast", async () => {
    const user = userEvent.setup();
    const salva = vi.fn<SalvaPunteggioAction>(salvaFinto);
    const annulla = vi.fn<AnnullaPunteggioAction>(annullaFinto);
    renderScheda({ salva, annulla });

    await user.type(campoA(), "19");
    await user.type(campoB(), "21");
    await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));

    const riepilogo = screen.getByTestId("riepilogo-punteggio");
    expect(riepilogo).toHaveTextContent("Conti/Gallo");
    expect(riepilogo.querySelector("[data-vincitore]")).toHaveTextContent(
      "Vince",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Riepilogo prima del salvataggio",
        }),
      ).toHaveFocus(),
    );

    await user.click(screen.getByRole("button", { name: "Conferma e salva" }));
    expect(salva).toHaveBeenCalledTimes(1);
    const data = salva.mock.calls[0][1];
    expect(Object.fromEntries(data)).toMatchObject({
      partitaId: daInserire.partita.id,
      versione: "1",
      puntiA: "19",
      puntiB: "21",
    });

    expect(await screen.findByTestId("esito-punteggio")).toHaveTextContent(
      "Punteggio salvato: Rinaldi/Moretti 19 – 21 Conti/Gallo.",
    );
    const azione = await screen.findByRole("button", {
      name: /^Annulla il salvataggio/,
    });
    await user.click(azione);
    await waitFor(() => expect(annulla).toHaveBeenCalledTimes(1));
    expect(annulla).toHaveBeenCalledWith({
      tappaId: daInserire.tappa.id,
      partitaId: daInserire.partita.id,
      versione: 2,
    });
    expect(await screen.findByTestId("esito-punteggio")).toHaveTextContent(
      "Salvataggio annullato",
    );
    expect(campoA()).toHaveValue("");
  });

  it("Modifica torna ai campi con i valori", async () => {
    const user = userEvent.setup();
    renderScheda({ initialValori: { a: "22", b: "24" } });
    await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));
    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.queryByTestId("riepilogo-punteggio")).toBeNull();
    expect(campoA()).toHaveValue("22");
    await waitFor(() => expect(campoA()).toHaveFocus());
  });

  it("una partita già salvata si corregge, con il punteggio attuale", () => {
    renderScheda({
      scheda: giaSalvata,
      initialPasso: "riepilogo",
      initialValori: { a: "21", b: "15" },
    });
    expect(
      screen.getByRole("heading", {
        name: "Correggi il punteggio",
        hidden: true,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("riepilogo-correzione")).toHaveTextContent(
      "Sostituisce il punteggio salvato 21–17",
    );
  });

  it("un conflitto lo dice e offre di ricaricare", () => {
    renderScheda({
      initialState: {
        status: "error",
        reason: "conflict",
        message: "Il punteggio di questa partita è cambiato nel frattempo.",
        at: 1,
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("cambiato");
    expect(
      screen.getByRole("link", { name: "Ricarica il punteggio" }),
    ).toBeInTheDocument();
  });
});

describe("conflitto tra admin (BLVS-34)", () => {
  const salvato = {
    versione: 3,
    sets: [{ a: 21, b: 18 }],
    autore: "Giulia Neri",
    salvatoIl: "2026-06-12T12:05:00Z",
  };

  /** Refuses the plain save; accepts only an overwrite of version 3. */
  function salvaConConflitto() {
    return vi.fn<SalvaPunteggioAction>(async (prev, formData) => {
      const at = prev.status === "idle" ? 1 : prev.at + 1;
      const a = Number(formData.get("puntiA"));
      const b = Number(formData.get("puntiB"));
      if (
        formData.get("sovrascrivi") === "1" &&
        formData.get("versione") === "3"
      ) {
        return {
          status: "success",
          partitaId: String(formData.get("partitaId")),
          versione: 4,
          punteggio: { a, b },
          tipo: "correzione",
          message: "Punteggio corretto",
          at,
        };
      }
      return {
        status: "conflict",
        salvato,
        mio: { a, b },
        message: "Un altro admin ha salvato questa partita prima di te.",
        at,
      };
    });
  }

  async function salvaDalRiepilogo(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));
    await user.click(screen.getByRole("button", { name: "Conferma e salva" }));
    return screen.findByRole("alertdialog", {
      name: "Il punteggio è cambiato",
    });
  }

  it("nessuna sovrascrittura silenziosa: mostra salvato e tuo, poi «Tieni il salvato»", async () => {
    const user = userEvent.setup();
    const salva = salvaConConflitto();
    renderScheda({ salva, initialValori: { a: "21", b: "19" } });

    const dialog = await salvaDalRiepilogo(user);
    expect(salva).toHaveBeenCalledTimes(1);
    expect(salva.mock.calls[0][1].get("sovrascrivi")).toBeNull();
    expect(
      within(dialog).getByRole("group", { name: /Salvato/ }),
    ).toHaveTextContent("set 1: 21 a 18");
    expect(
      within(dialog).getByRole("group", { name: "Il tuo" }),
    ).toHaveTextContent("set 1: 21 a 19");

    await user.click(
      within(dialog).getByRole("button", { name: "Tieni il salvato" }),
    );
    expect(salva).toHaveBeenCalledTimes(1);
    expect(campoA()).toHaveValue("21");
    expect(campoB()).toHaveValue("18");
    expect(screen.getByTestId("esito-punteggio")).toHaveTextContent(
      "Hai tenuto il punteggio salvato",
    );
    expect(screen.getByTestId("punteggio-attuale")).toHaveTextContent("21–18");

    // The next save is based on the kept version.
    await user.clear(campoB());
    await user.type(campoB(), "17");
    await salvaDalRiepilogo(user);
    expect(salva.mock.calls[1][1].get("versione")).toBe("3");
  });

  it("«Sovrascrivi» chiede conferma e salva sulla versione mostrata", async () => {
    const user = userEvent.setup();
    const salva = salvaConConflitto();
    renderScheda({ salva, initialValori: { a: "21", b: "19" } });

    const dialog = await salvaDalRiepilogo(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Sovrascrivi" }),
    );
    expect(salva).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Sì, sovrascrivi" }));
    await waitFor(() => expect(salva).toHaveBeenCalledTimes(2));
    const data = salva.mock.calls[1][1];
    expect(data.get("sovrascrivi")).toBe("1");
    expect(data.get("versione")).toBe("3");
    expect(data.get("puntiB")).toBe("19");
    expect(await screen.findByTestId("esito-punteggio")).toHaveTextContent(
      "Punteggio corretto",
    );
  });

  it("una pagina aggiornata non fa avanzare la versione letta", async () => {
    const user = userEvent.setup();
    const salva = vi.fn(salvaFinto);
    const { rerender } = renderScheda({
      salva,
      initialValori: { a: "21", b: "19" },
    });
    // Another admin saved: the refreshed page brings version 5.
    rerender(
      <ToastProvider>
        <InserimentoPunteggio
          scheda={{
            ...daInserire,
            partita: { ...daInserire.partita, versione: 5 },
          }}
          salva={salva}
          annulla={annullaFinto}
        />
        <Toaster />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Vai al riepilogo" }));
    await user.click(screen.getByRole("button", { name: "Conferma e salva" }));
    await waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    expect(salva.mock.calls[0][1].get("versione")).toBe("1");
  });
});
