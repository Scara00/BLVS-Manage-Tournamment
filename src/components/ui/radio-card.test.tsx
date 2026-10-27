import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadioCard, RadioCardGroup } from "./radio-card";

function Categoria(props: { error?: string; disabled?: boolean }) {
  return (
    <RadioCardGroup
      legend="Categoria"
      hint="Una sola scelta"
      defaultValue="m"
      {...props}
    >
      <RadioCard value="m" title="Maschile" description="2 contro 2" />
      <RadioCard value="f" title="Femminile" description="2 contro 2" />
      <RadioCard value="x" title="Misto" />
    </RadioCardGroup>
  );
}

describe("RadioCard", () => {
  it("espone radiogroup con nome dalla legenda e radio con il titolo", () => {
    render(<Categoria />);
    const group = screen.getByRole("radiogroup", { name: "Categoria" });
    expect(group).toHaveAccessibleDescription("Una sola scelta");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    const maschile = screen.getByRole("radio", { name: "Maschile" });
    expect(maschile).toHaveAttribute("aria-checked", "true");
    expect(maschile).toHaveAccessibleDescription("2 contro 2");
  });

  it("le frecce cambiano la selezione", async () => {
    render(<Categoria />);
    const maschile = screen.getByRole("radio", { name: "Maschile" });
    maschile.focus();
    fireEvent.keyDown(maschile, { key: "ArrowDown" });
    const femminile = screen.getByRole("radio", { name: "Femminile" });
    // Base UI moves focus in a microtask.
    await waitFor(() => expect(femminile).toHaveFocus());
    expect(femminile).toHaveAttribute("aria-checked", "true");
    expect(maschile).toHaveAttribute("aria-checked", "false");
  });

  it("il click sulla card seleziona", () => {
    render(<Categoria />);
    fireEvent.click(screen.getByText("Misto"));
    expect(screen.getByRole("radio", { name: "Misto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("l'errore è collegato al gruppo, che è aria-invalid", () => {
    render(<Categoria error="Scegli una categoria" />);
    const group = screen.getByRole("radiogroup", { name: "Categoria" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription(
      "Errore: Scegli una categoria Una sola scelta",
    );
  });

  it("disabilitato blocca la selezione", () => {
    render(<Categoria disabled />);
    fireEvent.click(screen.getByText("Misto"));
    expect(screen.getByRole("radio", { name: "Misto" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
