import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tape } from "./tape";

const meta = {
  title: "Tabellone/Tape",
  component: Tape,
  args: { size: 4, animated: true },
  argTypes: { size: { control: "inline-radio", options: [4, 8] } },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Spessa: Story = {
  args: { size: 8 },
};

export const RiduzioneMovimento: Story = {
  args: { reducedMotion: true },
};
