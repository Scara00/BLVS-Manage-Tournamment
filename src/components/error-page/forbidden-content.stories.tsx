import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ForbiddenContent } from "./forbidden-content";

/** Titled under Tabellone: storybook-scoreboard.spec.ts checks AAA (7:1) and no motion. */
const meta = {
  title: "Tabellone/Errore 403",
  component: ForbiddenContent,
  parameters: { layout: "fullscreen" },
  args: { currentRole: "giocatore", requiredRole: "admin" },
} satisfies Meta<typeof ForbiddenContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Testo200: Story = {
  parameters: { text200: true },
};
