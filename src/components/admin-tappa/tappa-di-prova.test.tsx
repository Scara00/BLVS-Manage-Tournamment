import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  GESTIONE_MESSAGES,
  type ProvaAction,
} from "@/lib/tappe/gestione-state";
import { TappaDiProva } from "./tappa-di-prova";

function renderProva(
  action: ProvaAction,
  props: Partial<Parameters<typeof TappaDiProva>[0]> = {},
) {
  return render(
    <ToastProvider>
      <TappaDiProva
        tappaId="t1"
        stato="bozza"
        prova={false}
        action={action}
        offline={false}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
}

describe("TappaDiProva", () => {
  it("su una bozza spenta: spiega cosa fa e la attiva con prova=true", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ProvaAction>(async () => ({
      status: "success",
      message: GESTIONE_MESSAGES.provaAttivata,
      at: 1,
    }));
    renderProva(action);

    const sezione = screen.getByRole("region", { name: "Tappa di prova" });
    expect(sezione).toHaveTextContent(/i giocatori non la vedono/);
    expect(screen.getByTestId("tappa-di-prova-stato")).toHaveTextContent(
      "Spenta.",
    );

    await user.click(
      screen.getByRole("button", { name: "Attiva la tappa di prova" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0]![1];
    expect(data.get("tappaId")).toBe("t1");
    expect(data.get("prova")).toBe("true");
    expect(
      await screen.findByText(GESTIONE_MESSAGES.provaAttivata),
    ).toBeInTheDocument();
  });

  it("attiva: si spegne con prova=false", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ProvaAction>(async () => ({
      status: "success",
      message: GESTIONE_MESSAGES.provaDisattivata,
      at: 1,
    }));
    renderProva(action, { prova: true });

    expect(screen.getByTestId("tappa-di-prova-stato")).toHaveTextContent(
      "Attiva.",
    );
    await user.click(
      screen.getByRole("button", { name: "Spegni la tappa di prova" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0]![1].get("prova")).toBe("false");
  });

  it("non compare su una tappa pubblicata senza prova", () => {
    renderProva(vi.fn<ProvaAction>(), { stato: "iscrizioni_aperte" });
    expect(screen.queryByTestId("tappa-di-prova")).not.toBeInTheDocument();
  });

  it("pubblicata ma ancora con prova: dice che non ha effetto e si può spegnere", () => {
    renderProva(vi.fn<ProvaAction>(), { stato: "in_corso", prova: true });
    expect(screen.getByTestId("tappa-di-prova-stato")).toHaveTextContent(
      /non ha effetto/,
    );
    expect(
      screen.getByRole("button", { name: "Spegni la tappa di prova" }),
    ).toBeInTheDocument();
  });

  it("errore: messaggio in un alert, sessione scaduta con il link per rientrare", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ProvaAction>(async () => ({
      status: "error",
      reason: "sessionExpired",
      message: GESTIONE_MESSAGES.sessionExpired,
      at: 1,
    }));
    renderProva(action);
    await user.click(
      screen.getByRole("button", { name: "Attiva la tappa di prova" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      GESTIONE_MESSAGES.sessionExpired,
    );
    expect(
      screen.getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute("href", "/sessione-scaduta?da=%2Fadmin%2Ftappe%2Ft1");
  });

  it("offline: il pulsante resta raggiungibile ma non invia", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ProvaAction>();
    renderProva(action, { offline: true });
    const pulsante = screen.getByRole("button", {
      name: "Attiva la tappa di prova",
    });
    expect(pulsante).toHaveAccessibleDescription(GESTIONE_MESSAGES.offline);
    await user.click(pulsante);
    expect(action).not.toHaveBeenCalled();
  });
});
