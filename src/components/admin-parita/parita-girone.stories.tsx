import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PARITA_MESSAGES } from "@/lib/gironi/parita/types";
import { ParitaGirone } from "./parita-girone";
import {
  paritaDueDemo,
  paritaTreDemo,
  risolviDemo,
  risolviInAttesa,
} from "./stories-data";

/**
 * w-admin-parita, opened from a group of w-admin-gironi or w-admin-live.
 * Open by default so axe sees the dialog.
 */
const meta = {
  title: "Admin/Risoluzione parità",
  component: ParitaGirone,
  args: {
    girone: paritaTreDemo(),
    risolvi: risolviDemo,
    defaultOpen: true,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md border-2 border-primary p-space-3">
        <Story />
      </div>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/live/m" },
    },
  },
} satisfies Meta<typeof ParitaGirone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three players level for 2nd place: criteria, order and reason. */
export const TreGiocatori: Story = {};

/** Two players level for 1st place. */
export const DueGiocatori: Story = { args: { girone: paritaDueDemo() } };

/** The signal in the group, dialog closed. */
export const Segnale: Story = { args: { defaultOpen: false } };

/** A decided tie: «Modifica la decisione» reopens it with the old reason. */
export const Decisa: Story = {
  args: {
    defaultOpen: false,
    girone: paritaTreDemo({
      ordine: ["demo-M-i4", "demo-M-i2", "demo-M-i3"],
      motivo: "Sorteggio: monetina al campo 2",
    }),
  },
};

/** The server refused the reason and the order. */
export const FieldErrors: Story = {
  args: {
    initialState: {
      status: "fieldErrors",
      fields: {
        motivo: PARITA_MESSAGES.motivoMancante,
        ordine: PARITA_MESSAGES.ordineNonValido,
      },
      at: 1,
    },
  },
};

/** The decision is being saved: confirmation open, action busy. */
export const Loading: Story = {
  args: { loading: true, risolvi: risolviInAttesa },
};

/** Another admin changed a score: the tie is no longer the same. */
export const Conflitto: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "conflict",
      message: PARITA_MESSAGES.conflict,
      at: 1,
    },
  },
};

export const Offline: Story = { args: { offline: true } };
