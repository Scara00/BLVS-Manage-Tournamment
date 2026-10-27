import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ServiceUnavailable } from "./service-unavailable";

/** Titled under Tabellone: storybook-scoreboard.spec.ts checks AAA (7:1) and no motion. */
const meta = {
  title: "Tabellone/Errore 503",
  component: ServiceUnavailable,
  parameters: { layout: "fullscreen" },
  args: {
    what: "L'iscrizione alla tappa",
    code: "ERR-503-ISCR",
    at: new Date("2026-06-14T08:05:09Z"),
    onRetry: fn(),
  },
} satisfies Meta<typeof ServiceUnavailable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** «Riprova» while the retry is in flight: spinner, aria-busy, focus kept. */
export const Caricamento: Story = {
  args: { retrying: true },
};

export const Testo200: Story = {
  parameters: { text200: true },
};
