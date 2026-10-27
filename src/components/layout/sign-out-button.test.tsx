import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SIGN_OUT_ERROR_MESSAGE,
  type SignOutState,
} from "@/lib/auth/sign-out-state";
import { SignOutButton } from "./sign-out-button";

function deferred() {
  let resolve!: (state: SignOutState) => void;
  const promise = new Promise<SignOutState>((r) => (resolve = r));
  return { promise, resolve };
}

describe("SignOutButton", () => {
  it("mostra l'errore restituito dall'azione in un alert", async () => {
    const action = vi.fn(async () => ({ error: SIGN_OUT_ERROR_MESSAGE }));
    render(<SignOutButton action={action} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Esci" }));
    });

    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(SIGN_OUT_ERROR_MESSAGE);
  });

  it("ignora un secondo clic mentre l'uscita è in corso", async () => {
    const pending = deferred();
    const action = vi.fn(() => pending.promise);
    render(<SignOutButton action={action} />);
    const button = screen.getByRole("button", { name: "Esci" });

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-disabled", "true");

    await act(async () => {
      fireEvent.click(button);
    });
    expect(action).toHaveBeenCalledOnce();

    await act(async () => {
      pending.resolve({ error: null });
    });
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
