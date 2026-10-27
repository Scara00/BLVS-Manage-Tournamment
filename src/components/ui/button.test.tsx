import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it.each(["primary", "secondary", "destructive", "link"] as const)(
    "renderizza la variante %s",
    (variant) => {
      render(<Button variant={variant}>Salva</Button>);
      const button = screen.getByRole("button", { name: "Salva" });
      expect(button).toHaveAttribute("data-variant", variant);
    },
  );

  it("disabilitato con motivo: testo visibile, collegato e focusabile", () => {
    render(
      <Button disabled disabledReason="Completa prima i dati della squadra">
        Iscrivi
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Iscrivi" });
    const reason = screen.getByText("Completa prima i dati della squadra");
    expect(reason).toBeVisible();
    expect(button).toHaveAttribute("aria-describedby", reason.id);
    expect(button).toHaveAccessibleDescription(
      "Completa prima i dati della squadra",
    );
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    button.focus();
    expect(button).toHaveFocus();
  });

  it("unisce aria-describedby del consumer con il motivo", () => {
    render(
      <>
        <p id="extra">Nota</p>
        <Button
          disabled
          disabledReason="Iscrizioni chiuse"
          aria-describedby="extra"
        >
          Iscrivi
        </Button>
      </>,
    );
    const button = screen.getByRole("button", { name: "Iscrivi" });
    const reason = screen.getByText("Iscrizioni chiuse");
    expect(button.getAttribute("aria-describedby")).toBe(`extra ${reason.id}`);
  });

  it("senza disabled il motivo non viene mostrato", () => {
    render(<Button disabledReason="Mai visibile">Iscrivi</Button>);
    expect(screen.queryByText("Mai visibile")).toBeNull();
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-describedby");
  });

  it("in caricamento imposta aria-busy, blocca il click e mantiene il nome", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salva
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Salva/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Caricamento…");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    button.focus();
    expect(button).toHaveFocus();
  });

  it("il click funziona quando è attivo", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salva</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
