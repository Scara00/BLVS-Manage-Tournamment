import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PhaseBadge } from "./phase-badge";

const meta = {
  title: "Tabellone/PhaseBadge",
  component: PhaseBadge,
  args: { phase: "gold" },
  argTypes: {
    phase: { control: "inline-radio", options: ["gold", "silver"] },
  },
} satisfies Meta<typeof PhaseBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Fasi: Story = {
  render: () => (
    <div className="flex items-center gap-stack-sm">
      <PhaseBadge phase="gold" />
      <PhaseBadge phase="silver" />
    </div>
  ),
};

/** PhaseBadge has no motion: it renders the same with reduced motion. */
export const RiduzioneMovimento: Story = {
  args: { phase: "silver" },
};
