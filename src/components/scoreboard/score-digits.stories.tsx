import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScoreDigits } from "./score-digits";

const meta = {
  title: "Tabellone/ScoreDigits",
  component: ScoreDigits,
  args: { value: 21, className: "text-3xl" },
  argTypes: {
    tone: { control: "inline-radio", options: ["default", "inverse", "tape"] },
  },
} satisfies Meta<typeof ScoreDigits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Toni: Story = {
  render: (args) => (
    <div className="flex items-center gap-stack">
      <ScoreDigits {...args} tone="default" />
      <ScoreDigits {...args} tone="inverse" />
      <ScoreDigits {...args} tone="tape" />
    </div>
  ),
};

export const Classifica: Story = {
  render: (args) => (
    <ol className="flex flex-col gap-stack-sm">
      {[1, 2, 10].map((position) => (
        <li key={position}>
          <ScoreDigits {...args} value={position} ordinal digits={2} />
        </li>
      ))}
    </ol>
  ),
};

/** ScoreDigits has no motion: it renders the same with reduced motion. */
export const RiduzioneMovimento: Story = {};
