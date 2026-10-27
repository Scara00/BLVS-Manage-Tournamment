import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { RigeneraAction } from "@/lib/gironi/rigenera/types";
import { RigeneraGironi } from "./rigenera-gironi";
import { punteggiPersiDemo, rigenerazioneDemo } from "./stories-rigenera";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/tappe/jesolo/gironi/m",
}));

function renderRigenera(action: RigeneraAction, punteggi = punteggiPersiDemo) {
  return render(
    <ToastProvider>
      <RigeneraGironi
        rigenerazione={rigenerazioneDemo(punteggi)}
        rigenera={action}
      />
      <Toaster />
    </ToastProvider>,
  );
}

const successo = (persi: number) =>
  vi.fn<RigeneraAction>(async () => ({
    status: "success",
    persi,
    gironi: 4,
    message: `Gironi rigenerati: 4 gironi. Persi ${persi} punteggi, annotati nel registro.`,
    at: 1,
  }));

describe("RigeneraGironi (w-admin-rigenera-conferma)", () => {
  it("senza punteggi rigenera subito, senza conferma", async () => {
    const user = userEvent.setup();
    const action = vi.fn<RigeneraAction>(async () => ({
      status: "success",
      persi: 0,
      gironi: 4,
      message: "Gironi rigenerati: 4 gironi.",
      at: 1,
    }));
    renderRigenera(action, []);

    await user.click(screen.getByRole("button", { name: "Rigenera gironi" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("attesi")).toBe("0");
    expect(data.get("conferma")).toBe("");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const esito = await screen.findByTestId("rigenera-esito");
    expect(esito).toHaveTextContent("Gironi rigenerati: 4 gironi.");
    await waitFor(() => expect(esito).toHaveFocus());
  });

  it("con punteggi dice quanti e quali si perdono", async () => {
    const user = userEvent.setup();
    renderRigenera(successo(3));

    await user.click(screen.getByRole("button", { name: "Rigenera gironi" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Rigenerare i gironi?",
    });
    expect(dialog).toHaveTextContent(
      "Rigenerando perdi 3 punteggi già inseriti.",
    );
    const elenco = screen.getByRole("list", {
      name: "Punteggi che si perdono",
    });
    expect(elenco.querySelectorAll("li")).toHaveLength(3);
    expect(
      screen.getByRole("listitem", {
        name: "Girone A · turno 1: Giulia Bianchi e Marco Rossi contro Sara Colombo e Luca Ferrari, 21-18, 19-21, 15-12",
      }),
    ).toBeInTheDocument();
  });

  it("senza spunta il pulsante resta attivo, l'errore è accanto alla casella e la casella prende il focus", async () => {
    const user = userEvent.setup();
    const action = successo(3);
    renderRigenera(action);

    await user.click(screen.getByRole("button", { name: "Rigenera gironi" }));
    const conferma = await screen.findByRole("button", {
      name: "Rigenera e perdi 3 punteggi",
    });
    expect(conferma).not.toHaveAttribute("aria-disabled", "true");
    expect(conferma).toBeEnabled();

    await user.click(conferma);
    const casella = screen.getByRole("checkbox", {
      name: "Ho capito che i 3 punteggi inseriti si perdono",
    });
    await waitFor(() => expect(casella).toHaveFocus());
    expect(casella).toHaveAttribute("aria-invalid", "true");
    expect(casella).toHaveAccessibleDescription(
      /Spunta la casella per confermare che perdi 3 punteggi\./,
    );
    expect(action).not.toHaveBeenCalled();

    // Space ticks the box, Enter on the confirm button submits.
    await user.keyboard(" ");
    expect(casella).toBeChecked();
    expect(casella).not.toHaveAttribute("aria-invalid", "true");
    await user.click(conferma);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("conferma")).toBe("on");
    expect(data.get("attesi")).toBe("3");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByTestId("rigenera-esito")).toHaveTextContent(
      "Persi 3 punteggi",
    );
  });

  it("se i punteggi sono cambiati mostra il nuovo elenco e chiede di nuovo", async () => {
    const user = userEvent.setup();
    const action = vi.fn<RigeneraAction>(async () => ({
      status: "error",
      reason: "conflict",
      message:
        "Nel frattempo i punteggi sono cambiati: ora se ne perdono 1. Controlla l'elenco e conferma di nuovo.",
      punteggi: punteggiPersiDemo.slice(0, 1),
      at: 1,
    }));
    renderRigenera(action, []);

    await user.click(screen.getByRole("button", { name: "Rigenera gironi" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Rigenerando perdi 1 punteggio");
    expect(screen.getByRole("alert")).toHaveTextContent("ora se ne perdono 1");
    expect(
      screen.getByRole("checkbox", {
        name: "Ho capito che il punteggio inserito si perde",
      }),
    ).not.toBeChecked();
  });

  it("l'errore del server sulla casella sposta il focus anche lui", async () => {
    const user = userEvent.setup();
    const action = vi.fn<RigeneraAction>(async () => ({
      status: "fieldErrors",
      fields: {
        conferma: "Spunta la casella per confermare che perdi 3 punteggi.",
      },
      at: 1,
    }));
    renderRigenera(action);
    await user.click(screen.getByRole("button", { name: "Rigenera gironi" }));
    const casella = await screen.findByRole("checkbox");
    await user.click(casella);
    await user.click(
      screen.getByRole("button", { name: "Rigenera e perdi 3 punteggi" }),
    );
    await waitFor(() => expect(casella).toHaveFocus());
    expect(casella).toHaveAttribute("aria-invalid", "true");
  });
});
