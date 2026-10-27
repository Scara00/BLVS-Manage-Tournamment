import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type FormEvent } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Field, Fieldset } from "./field";
import { Input } from "./input";
import { RadioCard, RadioCardGroup } from "./radio-card";
import { Select } from "./select";

type Errors = Partial<
  Record<"nome" | "categoria" | "formula" | "regolamento", string>
>;

/**
 * Registration-form mock that uses every BLVS-03 component. It is the
 * target of the keyboard e2e (e2e/storybook-keyboard.spec.ts).
 */
function ModuloIscrizione() {
  const [errors, setErrors] = useState<Errors>({});
  const [inviato, setInviato] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Errors = {};
    if (!String(data.get("nome") ?? "").trim())
      next.nome = "Inserisci il nome della squadra";
    if (!data.get("categoria")) next.categoria = "Scegli una categoria";
    if (!data.get("formula")) next.formula = "Scegli una formula";
    if (!data.get("regolamento"))
      next.regolamento = "Devi accettare il regolamento";
    setErrors(next);
    setInviato(Object.keys(next).length === 0);
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="titolo-iscrizione"
      className="flex max-w-md flex-col gap-space-5"
    >
      <div className="flex flex-wrap items-center gap-space-3">
        <h1 id="titolo-iscrizione" className="font-heading text-2xl font-bold">
          Iscrizione squadra
        </h1>
        <Badge variant="reg-open">Iscrizioni aperte</Badge>
      </div>
      <Field label="Nome squadra" required error={errors.nome}>
        <Input name="nome" autoComplete="off" />
      </Field>
      <Field label="Email del capitano" hint="Riceverai qui la conferma">
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="Categoria" required error={errors.categoria}>
        <Select name="categoria" placeholder="Scegli una categoria">
          <option value="m">Maschile</option>
          <option value="f">Femminile</option>
          <option value="x">Misto</option>
        </Select>
      </Field>
      <RadioCardGroup
        legend="Formula"
        name="formula"
        required
        error={errors.formula}
      >
        <RadioCard
          value="2x2"
          title="2 contro 2"
          description="Beach volley classico"
        />
        <RadioCard value="4x4" title="4 contro 4" description="Squadre miste" />
      </RadioCardGroup>
      <Fieldset legend="Regolamento" error={errors.regolamento}>
        <Checkbox
          name="regolamento"
          value="si"
          label="Accetto il regolamento del torneo"
        />
      </Fieldset>
      <div className="flex flex-wrap items-start gap-space-3">
        <Button type="submit">Iscrivi squadra</Button>
        <Button
          type="button"
          variant="secondary"
          disabled
          disabledReason="Disponibile dopo la conferma dell'iscrizione"
        >
          Paga la quota
        </Button>
      </div>
      <p role="status" className="text-base font-semibold text-success-fg">
        {inviato ? "Iscrizione inviata." : ""}
      </p>
    </form>
  );
}

const meta = {
  title: "UI/Modulo di esempio",
  component: ModuloIscrizione,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ModuloIscrizione>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
