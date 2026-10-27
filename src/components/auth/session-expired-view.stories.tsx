import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { voceDiProva } from "@/components/coda-punteggi/stories-fixtures";
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

/** w-admin-sessione: the admin session closed after the idle timeout. */
export const SessioneAdminChiusa: Story = {
  args: {
    variant: "admin",
    drafts: [
      {
        id: "admin-tappa-nuova",
        label: "Nuova tappa · Rimini",
        path: "/admin/tappe",
        savedAt: "2026-10-27T09:42:00.000Z",
        values: {},
      },
    ],
  },
};

export const SessioneAdminChiusaSenzaBozze: Story = {
  args: { variant: "admin", drafts: [] },
};

export const SessioneAdminChiusaText200: Story = {
  args: { ...SessioneAdminChiusa.args },
  parameters: { text200: true },
};

/** BLVS-33: scores entered before the session closed wait on the device. */
export const SessioneAdminChiusaConPunteggi: Story = {
  args: {
    variant: "admin",
    drafts: [],
    punteggi: [
      voceDiProva(),
      voceDiProva({
        chiave: "c0000000-0000-4000-8000-000000000009",
        etichetta: "Girone B · turno 3 · Gallo/Ferri – Conti/Russo",
        sets: [{ a: 22, b: 20 }],
        stato: "sessione_chiusa",
      }),
    ],
  },
};
