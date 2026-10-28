import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LiveBar } from "./live-bar";

const meta = {
  title: "Live/LiveBar",
  component: LiveBar,
  args: {
    status: "live",
    updatedAt: "2026-06-14T08:05:00.000Z",
    freshAt: "2026-06-14T08:30:00.000Z",
  },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["connecting", "live", "reconnecting", "offline"],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LiveBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const Offline: Story = {
  args: { status: "offline" },
};

export const Riconnessione: Story = {
  args: { status: "reconnecting" },
};

export const Connessione: Story = {
  args: { status: "connecting" },
};

export const RiduzioneMovimento: Story = {
  args: { reducedMotion: true },
};

export const Testo200: Story = {
  args: { status: "offline" },
  parameters: { text200: true },
};

/** BLVS-52: the one-line bar next to the greeting on w-home. */
export const Compatta: Story = {
  args: { compact: true },
};

export const CompattaOffline: Story = {
  args: { compact: true, status: "offline" },
};
