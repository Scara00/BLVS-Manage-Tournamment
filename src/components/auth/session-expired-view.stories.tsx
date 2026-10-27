import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MinimalShell } from "@/components/layout/minimal-shell";
import { SessionExpiredView } from "./session-expired-view";

/** w-sessione-scaduta, inside its page frame. */
const meta = {
  title: "Accesso/Sessione scaduta",
  component: SessionExpiredView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <MinimalShell back={false}>
        <Story />
      </MinimalShell>
    ),
  ],
  args: {
    destination: "Admin · Tappe",
    returnPath: "/admin/tappe",
    loginHref: "/accesso?da=%2Fadmin%2Ftappe&motivo=scaduta",
    drafts: [],
  },
} satisfies Meta<typeof SessionExpiredView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConBozze: Story = {
  args: {
    drafts: [
      {
        id: "iscrizione-tappa-rimini",
        label: "Iscrizione alla tappa di Rimini",
        path: "/tappe",
        savedAt: "2026-10-27T09:42:00.000Z",
        values: {},
      },
      {
        id: "punteggio-girone-a-3",
        label: "Punteggio girone A, partita 3",
        path: "/admin/tappe",
        savedAt: "2026-10-27T09:15:00.000Z",
        values: {},
      },
    ],
  },
};

export const Text200: Story = {
  args: { ...ConBozze.args },
  parameters: { text200: true },
};
