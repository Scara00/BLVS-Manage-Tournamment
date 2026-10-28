import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PunteggioDialog } from "./punteggio-dialog";
import { azioneFinta, tabelloneConcluso } from "./stories-data";

const partita = tabelloneConcluso.partite[0];

const meta = {
  title: "Admin/Gestione live/Correzione su tabellone concluso",
  component: PunteggioDialog,
  args: {
    partita,
    tappaId: "jesolo",
    categoria: "M",
    action: azioneFinta,
    onEsito: () => {},
    defaultOpen: true,
  },
  decorators: [
    (Story) => (
      <div className="p-space-2 [overflow-wrap:anywhere]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PunteggioDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * BLVS-43: the board is concluded; the correction asks for an explicit
 * confirmation listing the points that change.
 */
export const ConfermaConcluso: Story = {
  args: {
    initialState: {
      status: "confermaConcluso",
      partitaId: partita.id,
      sets: [{ a: 10, b: 21 }],
      firma: "storia",
      avviso: null,
      message: "Il tabellone è concluso: conferma la correzione.",
      cambi: [
        {
          iscrizioneId: "i-Bianchi",
          nome: "Luca Bianchi",
          prima: { posizione: 2, punti: 8 },
          dopo: { posizione: 1, punti: 12 },
        },
        {
          iscrizioneId: "i-Rossi",
          nome: "Luca Rossi",
          prima: { posizione: 1, punti: 12 },
          dopo: { posizione: 2, punti: 8 },
        },
      ],
      at: 1,
    },
  },
};

export const Testo200: Story = {
  ...ConfermaConcluso,
  parameters: { text200: true },
};
