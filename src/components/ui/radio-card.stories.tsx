import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RadioCard, RadioCardGroup } from "./radio-card";

const meta = {
  title: "UI/RadioCard",
  component: RadioCardGroup,
  parameters: { layout: "padded" },
  args: {
    legend: "Formula",
    hint: "Potrai cambiarla fino alla chiusura delle iscrizioni",
    defaultValue: "2x2",
    children: (
      <>
        <RadioCard
          value="2x2"
          title="2 contro 2"
          description="Beach volley classico"
        />
        <RadioCard
          value="4x4"
          title="4 contro 4"
          description="Squadre miste, campo grande"
        />
        <RadioCard value="kotc" title="King of the court" />
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RadioCardGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focus: Story = {
  play: async ({ canvas }) => {
    canvas.getByRole("radio", { name: "2 contro 2" }).focus();
  },
};

export const Disabilitato: Story = { args: { disabled: true } };

export const Errore: Story = {
  args: {
    defaultValue: undefined,
    required: true,
    error: "Scegli una formula",
  },
};

export const Caricamento: Story = { args: { loading: true } };

export const Testo200: Story = {
  parameters: { text200: true },
  args: { error: "Scegli una formula" },
};

export const BordoCampo: Story = { args: { size: "campo" } };
