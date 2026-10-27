import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NotFoundContent } from "./not-found-content";

/** Titled under Tabellone: storybook-scoreboard.spec.ts checks AAA (7:1) and no motion. */
const meta = {
  title: "Tabellone/Errore 404",
  component: NotFoundContent,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NotFoundContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Admin: Story = {
  args: { stagesHref: "/admin/tappe", homeHref: "/admin" },
};

export const Testo200: Story = {
  parameters: { text200: true },
};
