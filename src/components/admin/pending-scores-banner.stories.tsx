import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PendingScoresBannerView } from "./pending-scores-banner";

const jesolo = { id: "jesolo", label: "Tappa 1 · Jesolo", count: 3 };

const meta = {
  title: "Amministrazione/Banner partite da inserire",
  component: PendingScoresBannerView,
  args: { stages: [jesolo] },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PendingScoresBannerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UnaPartita: Story = {
  args: { stages: [{ ...jesolo, count: 1 }] },
};

export const TuttoInserito: Story = {
  args: { stages: [{ ...jesolo, count: 0 }] },
};

export const PiuTappe: Story = {
  args: {
    stages: [
      jesolo,
      {
        id: "lungo",
        label:
          "Tappa 5 · Marina di Pietrasanta, Bagno Arcobaleno — Memorial Santamaria-Lombardi",
        count: 12,
      },
    ],
  },
};
