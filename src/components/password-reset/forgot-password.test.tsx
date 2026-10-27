import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordFlow } from "./forgot-password-form";
import {
  COOLDOWN_END_ANNOUNCEMENT,
  COOLDOWN_START_ANNOUNCEMENT,
  ForgotPasswordSent,
} from "./forgot-password-sent";

vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string }) => (
    <a href={href} {...props} />
  ),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("w-forgot", () => {
  it("con email mancante o non valida mostra l'errore e ci porta il focus", async () => {
    const request = vi.fn();
    const user = userEvent.setup();
    render(<ForgotPasswordFlow request={request} />);

    await user.click(screen.getByRole("button", { name: "Invia il link" }));
    const email = screen.getByRole("textbox", { name: /Email/ });
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(/Inserisci la tua email/);
    await waitFor(() => expect(email).toHaveFocus());

    await user.type(email, "nome@");
    await user.keyboard("{Enter}");
    expect(email).toHaveAccessibleDescription(/email valida/);
    expect(request).not.toHaveBeenCalled();
  });

  it("dopo l'invio passa a «Controlla la tua email» con il focus sul titolo", async () => {
    const request = vi.fn().mockResolvedValue({ kind: "ok", data: {} });
    const user = userEvent.setup();
    render(<ForgotPasswordFlow request={request} />);

    await user.type(
      screen.getByRole("textbox", { name: /Email/ }),
      " a@example.it ",
    );
    await user.keyboard("{Enter}");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Controlla la tua email",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(request).toHaveBeenCalledWith("a@example.it");
    expect(screen.getByText("a@example.it")).toBeInTheDocument();
  });

  it("offline e rete: messaggio di errore, il modulo resta", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ kind: "offline" })
      .mockResolvedValueOnce({ kind: "network" });
    const user = userEvent.setup();
    render(<ForgotPasswordFlow request={request} />);
    await user.type(
      screen.getByRole("textbox", { name: /Email/ }),
      "a@example.it",
    );

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sei offline/);
    await user.click(screen.getByRole("button", { name: "Invia il link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Non riusciamo a raggiungere il server/,
    );
  });

  it("arrivando da un link scaduto lo spiega", () => {
    render(<ForgotPasswordFlow linkExpired />);
    expect(
      screen.getByText(/Il link che hai aperto è scaduto o è già stato usato/),
    ).toBeInTheDocument();
  });
});

describe("w-forgot-sent", () => {
  it("blocca «Invia di nuovo» per 60 s e annuncia solo inizio e fine", async () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "performance",
      ],
    });
    const onResend = vi.fn().mockResolvedValue({ kind: "ok", data: {} });
    render(<ForgotPasswordSent email="a@example.it" onResend={onResend} />);

    const status = screen.getByRole("status");
    const button = screen.getByRole("button", { name: "Invia di nuovo" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(
      "Puoi chiedere un nuovo invio tra 1:00.",
    );

    const announced: string[] = [];
    const observer = new MutationObserver(() => {
      if (status.textContent) announced.push(status.textContent);
    });
    observer.observe(status, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    await act(async () => vi.advanceTimersByTime(30_000));
    expect(button).toHaveAccessibleDescription(
      "Puoi chiedere un nuovo invio tra 0:30.",
    );
    button.focus();
    await act(async () => vi.advanceTimersByTime(30_500));
    await act(async () => vi.advanceTimersByTime(100));
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(button).toHaveFocus();
    observer.disconnect();
    expect(announced).toEqual([
      COOLDOWN_START_ANNOUNCEMENT,
      COOLDOWN_END_ANNOUNCEMENT,
    ]);

    await act(async () => button.click());
    expect(onResend).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(500));
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(status).toHaveTextContent(COOLDOWN_START_ANNOUNCEMENT);
  });

  it("mostra l'errore se il nuovo invio non riesce", async () => {
    const onResend = vi.fn().mockResolvedValue({ kind: "network" });
    const user = userEvent.setup();
    render(
      <ForgotPasswordSent
        email="a@example.it"
        cooldownSeconds={0}
        onResend={onResend}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Invia di nuovo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /raggiungere il server/,
    );
  });
});
