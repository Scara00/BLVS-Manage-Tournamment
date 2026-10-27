import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_TIMEOUT, ToastProvider, Toaster, useToast } from "./toast";

function Annulla({ onUndo }: { onUndo?: () => void }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast.add({
          title: "Squadra eliminata",
          description: "I Bagnini è stata rimossa dal torneo.",
          actionProps: onUndo && { children: "Annulla", onClick: onUndo },
        })
      }
    >
      Elimina squadra
    </button>
  );
}

function renderToaster(onUndo?: () => void) {
  render(
    <ToastProvider>
      <Annulla onUndo={onUndo} />
      <Toaster />
    </ToastProvider>,
  );
}

/** Advances the clock, then lets Base UI finish its exit (promises + rAF). */
async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.runOnlyPendingTimersAsync();
  });
}

function showToast() {
  fireEvent.click(screen.getByRole("button", { name: "Elimina squadra" }));
  return screen.getByRole("dialog", { name: "Squadra eliminata" });
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("annuncia in una regione aria-live polite", () => {
    renderToaster();
    showToast();

    const region = screen.getByRole("region", { name: "Notifiche" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Squadra eliminata");
  });

  it("dura 6 secondi", () => {
    expect(TOAST_TIMEOUT).toBe(6000);
  });

  it("scompare dopo il timeout", async () => {
    renderToaster();
    const toast = showToast();

    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT - 100));
    expect(toast).toBeInTheDocument();

    await flush(200);
    expect(
      screen.queryByRole("dialog", { name: "Squadra eliminata" }),
    ).toBeNull();
  });

  it("si mette in pausa al passaggio del mouse e riprende all'uscita", async () => {
    renderToaster();
    showToast();
    const region = screen.getByRole("region", { name: "Notifiche" });

    act(() => vi.advanceTimersByTime(1000));
    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT * 3));
    expect(
      screen.getByRole("dialog", { name: "Squadra eliminata" }),
    ).toBeInTheDocument();

    fireEvent.mouseLeave(region);
    await flush(TOAST_TIMEOUT);
    expect(
      screen.queryByRole("dialog", { name: "Squadra eliminata" }),
    ).toBeNull();
  });

  it("l'azione chiama il suo handler", () => {
    const onUndo = vi.fn();
    renderToaster(onUndo);
    showToast();

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("ha un pulsante di chiusura etichettato", async () => {
    renderToaster();
    showToast();

    fireEvent.click(screen.getByRole("button", { name: "Chiudi notifica" }));
    await flush(0);

    expect(
      screen.queryByRole("dialog", { name: "Squadra eliminata" }),
    ).toBeNull();
  });
});
