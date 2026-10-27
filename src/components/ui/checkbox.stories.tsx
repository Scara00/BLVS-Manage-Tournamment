import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./checkbox";
import { Fieldset } from "./field";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "padded" },
  args: { label: "Accetto il regolamento del torneo" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selezionata: Story = { args: { defaultChecked: true } };

export const ConDescrizione: Story = {
  args: {
    label: "Ricevi la newsletter",
    description: "Al massimo una email al mese",
  },
};

export const Focus: Story = {
  play: async ({ canvas }) => {
    canvas.getByRole("checkbox").focus();
  },
};

export const Disabilitato: Story = {
  render: (args) => (
    <div className="flex flex-col gap-space-2">
      <Checkbox {...args} disabled />
      <Checkbox
        {...args}
        label="Certificato medico caricato"
        disabled
        defaultChecked
      />
    </div>
  ),
};

export const Errore: Story = {
  render: (args) => (
    <Fieldset
      legend="Regolamento"
      required
      error="Devi accettare il regolamento"
    >
      <Checkbox {...args} />
    </Fieldset>
  ),
};

export const Gruppo: Story = {
  render: () => (
    <Fieldset legend="Giorni disponibili" hint="Seleziona almeno un giorno">
      <Checkbox label="Sabato" />
      <Checkbox label="Domenica" defaultChecked />
    </Fieldset>
  ),
};

export const Caricamento: Story = {
  render: (args) => (
    <Fieldset legend="Regolamento" loading>
      <Checkbox {...args} />
    </Fieldset>
  ),
};

export const Testo200: Story = {
  parameters: { text200: true },
  render: (args) => (
    <Fieldset legend="Regolamento" error="Devi accettare il regolamento">
      <Checkbox {...args} description="Versione 2026, pubblicata a marzo" />
    </Fieldset>
  ),
};

export const BordoCampo: Story = { args: { size: "campo" } };
