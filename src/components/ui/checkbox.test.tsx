import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";
import { Fieldset } from "./field";

describe("Checkbox", () => {
  it("ha ruolo checkbox e nome dall'etichetta", () => {
    render(<Checkbox label="Accetto il regolamento" />);
    expect(
      screen.getByRole("checkbox", { name: "Accetto il regolamento" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("si attiva con il click sull'etichetta", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Accetto" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByText("Accetto"));
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it("si attiva con la barra spaziatrice", () => {
    render(<Checkbox label="Accetto" />);
    const checkbox = screen.getByRole("checkbox");
    checkbox.focus();
    fireEvent.keyDown(checkbox, { key: " ", code: "Space" });
    fireEvent.keyUp(checkbox, { key: " ", code: "Space" });
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("la descrizione non entra nel nome ma nella descrizione", () => {
    render(<Checkbox label="Newsletter" description="Una email al mese" />);
    const checkbox = screen.getByRole("checkbox", { name: "Newsletter" });
    expect(checkbox).toHaveAccessibleDescription("Una email al mese");
  });

  it("in un Fieldset con errore è aria-invalid e collegato all'errore", () => {
    render(
      <Fieldset legend="Privacy" error="Devi accettare il regolamento">
        <Checkbox label="Accetto il regolamento" />
      </Fieldset>,
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "Accetto il regolamento",
    });
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAccessibleDescription(
      "Errore: Devi accettare il regolamento",
    );
  });

  it("disabilitato non cambia stato", () => {
    render(<Checkbox label="Accetto" disabled />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByText("Accetto"));
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });
});
