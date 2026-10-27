import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PunteggioParziale } from "./punteggio-parziale";

const meta = {
  title: "Live/Punteggio parziale",
  component: PunteggioParziale,
  args: {
    partial: { home: 14, away: 11, updatedAt: "2027-06-12T08:42:00.000Z" },
    home: "Luca Rossi e Marco Bianchi",
    away: "Paolo Marino e Andrea Greco",
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PunteggioParziale>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Match in progress: «Parziale · in corso» on color.live. */
export const InCorso: Story = {};

/** Connection lost: says since when the value is frozen. */
export const Offline: Story = {
  args: { offline: true, freshAt: "2027-06-12T08:45:00.000Z" },
};

/** Reduced motion: the digits change without the flap. */
export const RiduzioneMovimento: Story = {
  args: { reducedMotion: true },
  render: function Render(args) {
    const [home, setHome] = useState(args.partial.home);
    return (
      <div className="flex flex-col items-start gap-stack">
        <PunteggioParziale {...args} partial={{ ...args.partial, home }} />
        <Button onClick={() => setHome((v) => v + 1)}>+1 casa</Button>
      </div>
    );
  },
};
