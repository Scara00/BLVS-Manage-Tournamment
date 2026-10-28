import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FaseConclusaBadge } from "./fase-conclusa-badge";

const meta = {
  title: "Admin/Fase conclusa",
  component: FaseConclusaBadge,
  decorators: [
    (Story) => (
      <p className="flex flex-wrap items-center gap-space-2 p-inset">
        <span>Fase del tabellone:</span>
        <Story />
      </p>
    ),
  ],
} satisfies Meta<typeof FaseConclusaBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The board's phase «Conclusa»: black on tape, always with its text. */
export const Default: Story = {};

export const Testo200: Story = { parameters: { text200: true } };
