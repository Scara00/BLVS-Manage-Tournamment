import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import type { CambioCategoriaAction } from "@/lib/giocatori/admin/types";
import { CambiaCategoria } from "./cambia-categoria";
import { effettiVersoF, elenco, scheda } from "./fixtures";
import { GiocatoriAdmin } from "./giocatori-admin";
import { SchedaGiocatoreAdmin } from "./scheda-giocatore-admin";

vi.mock("next/form", () => ({
  default: (props: React.ComponentProps<"form">) => <form {...props} />,
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: ToastProvider });
}

const idle: CambioCategoriaAction = async () => ({ status: "idle" });

describe("GiocatoriAdmin", () => {
  it("elenca i giocatori con link alla scheda e lo stato della verifica a testo", () => {
    render(
      <GiocatoriAdmin
        elenco={elenco("completo")}
        filtri={{ q: "", daVerificare: false, pagina: 1 }}
      />,
    );
    expect(screen.getByTestId("giocatori-totale")).toHaveTextContent(
      "7 giocatori",
    );
    expect(
      screen.getAllByRole("link", { name: "Rossi Luca" })[0],
    ).toHaveAttribute("href", "/admin/giocatori/u5");
    expect(screen.getAllByText("Da verificare").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("searchbox", { name: /Cerca/ }),
    ).toBeInTheDocument();
  });

  it("filtro da verificare e paginazione nell'URL", () => {
    render(
      <GiocatoriAdmin
        elenco={elenco("pagine")}
        filtri={{ q: "ro", daVerificare: true, pagina: 2 }}
      />,
    );
    expect(screen.getByTestId("giocatori-totale")).toHaveTextContent(
      "57 giocatori da verificare per «ro»",
    );
    expect(
      screen.getByRole("link", { name: /Pagina precedente/ }),
    ).toHaveAttribute("href", "/admin/giocatori?q=ro&verifica=1");
    expect(
      screen.getByRole("link", { name: /Pagina successiva/ }),
    ).toHaveAttribute("href", "/admin/giocatori?q=ro&verifica=1&pagina=3");
  });

  it("messaggio quando non c'è nessuno da verificare", () => {
    render(
      <GiocatoriAdmin
        elenco={elenco("vuoto")}
        filtri={{ q: "", daVerificare: true, pagina: 1 }}
      />,
    );
    expect(
      screen.getByText("Nessun giocatore con la categoria da verificare."),
    ).toBeInTheDocument();
  });
});

describe("SchedaGiocatoreAdmin", () => {
  it("mostra dati, iscrizioni e punti per stagione", () => {
    render(
      <SchedaGiocatoreAdmin scheda={scheda()} cambia={idle} verifica={idle} />,
    );
    expect(screen.getByTestId("scheda-categoria")).toHaveTextContent(
      "Maschile",
    );
    expect(
      screen.getByRole("heading", { name: "Iscrizioni" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Tappa 4 · Lignano").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20 (provvisori)").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", {
        name: "Segna la categoria come verificata",
      }),
    ).toBeInTheDocument();
  });
});

describe("CambioCategoriaDialog", () => {
  it("da tastiera: apre, elenca gli effetti, Esc chiude e il focus torna al bottone", async () => {
    const user = userEvent.setup();
    render(
      <CambiaCategoria
        utenteId="u5"
        nome="Luca Rossi"
        cambi={[effettiVersoF()]}
        action={idle}
      />,
    );
    const bottone = screen.getByRole("button", { name: "Cambia in femminile" });
    bottone.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("alertdialog", {
      name: "Cambiare la categoria di Luca Rossi in femminile?",
    });
    const iscrizioni = within(dialog).getByTestId("cambio-effetti-iscrizioni");
    expect(iscrizioni).toHaveTextContent(
      "Tappa 4 · Lignano (4 luglio 2027): dal posto 7 del tabellone maschile al posto 17 del femminile, oltre il massimo di 16 posti (tabellone pieno).",
    );
    expect(iscrizioni).toHaveTextContent("Esce dai gironi già proposti");
    expect(
      within(dialog).getByTestId("cambio-effetti-punti"),
    ).toHaveTextContent(
      "Stagione 2026: 32 punti (3 tappe) passano dalla classifica maschile (ora 1º) a quella femminile (sarà 2º).",
    );
    // Focus starts on the safe choice.
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Annulla" }),
      ).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(bottone).toHaveFocus());
  });

  it("conferma: invia categoria ed effetti attesi, poi il focus va all'esito", async () => {
    const user = userEvent.setup();
    const ricevuti: FormData[] = [];
    const action: CambioCategoriaAction = async (_prev, formData) => {
      ricevuti.push(formData);
      return { status: "success", message: "Categoria cambiata.", at: 1 };
    };
    render(
      <CambiaCategoria
        utenteId="u5"
        nome="Luca Rossi"
        cambi={[effettiVersoF()]}
        action={action}
        initialAperto="F"
      />,
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.type(
      within(dialog).getByRole("textbox"),
      "Richiesta della giocatrice",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Sì, cambia in femminile" }),
    );
    await waitFor(() => expect(ricevuti).toHaveLength(1));
    expect(ricevuti[0].get("categoria")).toBe("F");
    expect(ricevuti[0].get("nota")).toBe("Richiesta della giocatrice");
    expect(JSON.parse(String(ricevuti[0].get("attesi")))).toEqual([
      { iscrizione_id: "i-lignano", posto_dopo: 17 },
      { iscrizione_id: "i-sabaudia", posto_dopo: 6 },
    ]);
    const esito = await screen.findByTestId("esito-cambio-categoria");
    await waitFor(() => expect(esito).toHaveTextContent("Categoria cambiata."));
    await waitFor(() => expect(esito).toHaveFocus());
  });

  it("una tappa in corso blocca il cambio e lo dice a testo", async () => {
    render(
      <CambiaCategoria
        utenteId="u5"
        nome="Luca Rossi"
        cambi={[effettiVersoF("bloccato")]}
        action={idle}
        initialAperto="F"
      />,
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByTestId("cambio-categoria-bloccato"),
    ).toHaveTextContent("È iscritto a Tappa 2 · Rimini, in corso");
    expect(
      within(dialog).queryByRole("button", { name: /Sì, cambia/ }),
    ).not.toBeInTheDocument();
  });
});
