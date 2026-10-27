import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ParzialeForm } from "./parziale-form";
import {
  inCorso,
  inviaParzialeConflitto,
  inviaParzialeFinto,
} from "./stories-data";

/** w-admin-punteggio, match in progress: the partial for w-live (BLVS-37). */
const meta = {
  title: "Admin/Punteggio parziale",
  component: ParzialeForm,
  args: { scheda: inCorso, invia: inviaParzialeFinto },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ParzialeForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The last partial sent (14–11) in the fields, ready for −/+. */
export const InCorso: Story = {};

/** Sent: a status message, focus stays on «Invia parziale». */
export const Inviato: Story = {
  args: {
    initialValori: { a: "15", b: "11" },
    initialState: {
      status: "success",
      versione: 4,
      punti: { a: 15, b: 11 },
      message: "Parziale inviato ai giocatori",
      at: 1,
    },
  },
};

/** No partial sent yet. */
export const Primo: Story = {
  args: {
    scheda: { ...inCorso, partita: { ...inCorso.partita, parziale: null } },
  },
};

/** No network: the button is off and says why; nothing is queued. */
export const Offline: Story = { args: { offline: true } };

/** Another admin sent first: press «Invia parziale» to open the dialog. */
export const Conflitto: Story = { args: { invia: inviaParzialeConflitto } };
