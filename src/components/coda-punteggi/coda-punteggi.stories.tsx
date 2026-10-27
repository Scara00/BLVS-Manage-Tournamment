import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CodaPunteggiView } from "./coda-punteggi-view";
import { StatoInvio } from "./stato-invio";
import { CODA_MISTA, voceDiProva } from "./stories-fixtures";

/** BLVS-33: scores kept on the device until they reach the server. */
const meta = {
  title: "Admin/Coda punteggi",
  component: CodaPunteggiView,
  args: { voci: [voceDiProva()] },
} satisfies Meta<typeof CodaPunteggiView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No network: the score waits on the device («in attesa di invio»). */
export const InAttesa: Story = {};

export const Salvato: Story = {
  args: { voci: [voceDiProva({ stato: "salvato", versione: 2 })] },
};

/** The admin session closed: «Salvato qui, non ancora inviato». */
export const SessioneChiusa: Story = {
  args: { voci: [voceDiProva({ stato: "sessione_chiusa" })] },
};

export const Conflitto: Story = {
  args: { voci: [CODA_MISTA[2]] },
};

export const Misto: Story = {
  args: { voci: CODA_MISTA },
};

export const MistoText200: Story = {
  args: { voci: CODA_MISTA },
  parameters: { text200: true },
};

/** Every state of the badge, as text. */
export const Stati: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-space-2">
      <StatoInvio stato="in_attesa" />
      <StatoInvio stato="salvato" />
      <StatoInvio stato="sessione_chiusa" />
      <StatoInvio stato="conflitto" />
      <StatoInvio stato="rifiutato" />
    </div>
  ),
};
