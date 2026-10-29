import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "./field";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Field,
  parameters: { layout: "padded" },
  args: {
    label: "Motivo",
    hint: "Resta nell'elenco delle tappe dell'area admin.",
    children: <Textarea />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Errore: Story = {
  args: {
    required: true,
    error: "Indica il motivo dell'annullamento.",
    children: <Textarea />,
  },
};

export const Testo200: Story = {
  parameters: { text200: true },
  args: { required: true, error: "Indica il motivo dell'annullamento." },
};
