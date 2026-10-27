import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FlipDigits } from "./flip-digits";

const meta = {
  title: "Tabellone/FlipDigits",
  component: FlipDigits,
  args: { value: 21, minDigits: 2, className: "text-4xl" },
  argTypes: {
    pad: { control: "inline-radio", options: ["zero", "blank"] },
  },
} satisfies Meta<typeof FlipDigits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RiduzioneMovimento: Story = {
  args: { reducedMotion: true },
};

export const Interattivo: Story = {
  args: { value: 9, live: true },
  render: function Render(args) {
    const [value, setValue] = useState(Number(args.value));
    return (
      <div className="flex flex-col items-center gap-stack">
        <FlipDigits {...args} value={value} label={`${value} punti`} />
        <Button onClick={() => setValue((v) => v + 1)}>+1</Button>
      </div>
    );
  },
};

export const Orario: Story = {
  args: { value: "09:30", label: "ore 9 e 30" },
};
