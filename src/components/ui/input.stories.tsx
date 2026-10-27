import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "./field";
import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Field,
  parameters: { layout: "padded" },
  args: {
    label: "Nome squadra",
    hint: "Come apparirà sul tabellone",
    children: <Input placeholder="Es. Sabbia Mobile" />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focus: Story = {
  play: async ({ canvas }) => {
    canvas.getByRole("textbox").focus();
  },
};

export const Obbligatorio: Story = { args: { required: true } };

export const Disabilitato: Story = {
  args: { disabled: true, children: <Input defaultValue="Sabbia Mobile" /> },
};

export const Errore: Story = {
  args: {
    required: true,
    error: "Inserisci il nome della squadra",
    children: <Input />,
  },
};

export const Caricamento: Story = { args: { loading: true } };

export const Testo200: Story = {
  parameters: { text200: true },
  args: { required: true, error: "Inserisci il nome della squadra" },
};

export const BordoCampo: Story = {
  args: { size: "campo", label: "Punteggio", hint: undefined },
};
