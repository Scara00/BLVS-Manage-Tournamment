import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Fieldset } from "./field";
import { Input } from "./input";
import { Select } from "./select";

describe("Field con Input", () => {
  it("associa l'etichetta al controllo", () => {
    render(
      <Field label="Nome squadra">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Nome squadra")).toBeInstanceOf(
      HTMLInputElement,
    );
  });

  it("collega suggerimento ed errore in aria-describedby", () => {
    render(
      <Field
        label="Email"
        hint="La useremo per la conferma"
        error="Inserisci un'email valida"
      >
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const hint = screen.getByText("La useremo per la conferma");
    const error = screen.getByText("Inserisci un'email valida").closest("p")!;
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toEqual([error.id, hint.id]);
    expect(input).toHaveAccessibleDescription(
      "Errore: Inserisci un'email valida La useremo per la conferma",
    );
  });

  it("aria-invalid solo in presenza di errore", () => {
    const { rerender } = render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    rerender(
      <Field label="Email" error="Campo obbligatorio">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("l'errore segue il controllo nel DOM", () => {
    render(
      <Field label="Email" hint="Suggerimento" error="Errore di formato">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const error = screen.getByText("Errore di formato").closest("p")!;
    expect(input.nextElementSibling).toBe(error);
  });

  it("mostra il testo obbligatorio e marca il controllo", () => {
    render(
      <Field label="Cognome" required>
        <Input />
      </Field>,
    );
    expect(screen.getByText("(obbligatorio)")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Cognome/ })).toBeRequired();
  });

  it("in caricamento disabilita il controllo e mostra il testo", () => {
    render(
      <Field label="Categoria" loading>
        <Select>
          <option>Open</option>
        </Select>
      </Field>,
    );
    const select = screen.getByLabelText("Categoria");
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute("aria-busy", "true");
    expect(select).toHaveAccessibleDescription("Caricamento…");
  });

  it("disabilitato propaga al controllo", () => {
    render(
      <Field label="Nome" disabled>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Nome")).toBeDisabled();
  });

  it("le props del controllo vincono sul Field e describedby si unisce", () => {
    render(
      <>
        <p id="nota">Nota</p>
        <Field label="Nome" hint="Suggerimento" id="nome-squadra">
          <Input aria-describedby="nota" />
        </Field>
      </>,
    );
    const input = screen.getByLabelText("Nome");
    expect(input.id).toBe("nome-squadra");
    expect(input.getAttribute("aria-describedby")).toMatch(/^nota /);
  });
});

describe("Field con Select", () => {
  it("collega etichetta, errore e segnaposto", () => {
    render(
      <Field label="Categoria" error="Scegli una categoria">
        <Select placeholder="Seleziona…">
          <option value="m">Maschile</option>
          <option value="f">Femminile</option>
        </Select>
      </Field>,
    );
    const select = screen.getByRole("combobox", { name: "Categoria" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Errore: Scegli una categoria");
    expect(screen.getByRole("option", { name: "Seleziona…" })).toHaveValue("");
  });
});

describe("Fieldset", () => {
  it("usa una legenda visibile come nome del gruppo", () => {
    render(
      <Fieldset legend="Preferenze" required>
        <input type="checkbox" aria-label="a" />
      </Fieldset>,
    );
    expect(screen.getByRole("group", { name: /Preferenze/ })).toBeVisible();
    expect(screen.getByText("(obbligatorio)")).toBeVisible();
  });
});
