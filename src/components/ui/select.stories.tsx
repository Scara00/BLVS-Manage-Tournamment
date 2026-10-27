import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "./field";
import { Select } from "./select";

const opzioni = (
  <>
    <option value="m">Maschile</option>
    <option value="f">Femminile</option>
    <option value="x">Misto</option>
  </>
);

const meta = {
  title: "UI/Select",
  component: Field,
  parameters: { layout: "padded" },
  args: {
    label: "Categoria",
    children: <Select placeholder="Scegli una categoria">{opzioni}</Select>,
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
    canvas.getByRole("combobox").focus();
  },
};

export const Disabilitato: Story = {
  args: {
    disabled: true,
    children: <Select defaultValue="f">{opzioni}</Select>,
  },
};

export const Errore: Story = {
  args: { required: true, error: "Scegli una categoria" },
};

/** Options still loading: disabled, aria-busy, visible text. */
export const Caricamento: Story = {
  args: {
    loading: true,
    children: <Select placeholder="Scegli una categoria" />,
  },
};

export const Testo200: Story = {
  parameters: { text200: true },
  args: { hint: "La categoria del torneo", error: "Scegli una categoria" },
};

export const BordoCampo: Story = { args: { size: "campo" } };
