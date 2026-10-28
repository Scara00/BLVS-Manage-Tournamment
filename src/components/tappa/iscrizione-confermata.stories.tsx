import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { withText200 } from "@/design-system/text-200";
import { ANNULLA_ISCRIZIONE_INITIAL } from "@/lib/iscrizioni/annullamento/state";
import { CONFERMATA } from "./fixtures";
import { IscrizioneConfermataView } from "./iscrizione-confermata";

const meta = {
  title: "Tappa/Iscrizione confermata",
  component: IscrizioneConfermataView,
  // AnnullaIscrizione navigates after a cancel (useRouter).
  parameters: { nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster />
      </ToastProvider>
    ),
  ],
  args: {
    iscrizione: CONFERMATA,
    annulla: async () => ANNULLA_ISCRIZIONE_INITIAL,
  },
} satisfies Meta<typeof IscrizioneConfermataView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confermata: Story = {};
export const SenzaRitrovo: Story = {
  args: {
    iscrizione: {
      ...CONFERMATA,
      ritrovo: null,
      ritrovoAlle: null,
      annullaEntro: null,
      annullaEntroIso: null,
      annullamento: null,
    },
  },
};
/** Past the cancel deadline: no button, the reason in words. */
export const DopoLaScadenza: Story = {
  args: {
    iscrizione: {
      ...CONFERMATA,
      annullamento: CONFERMATA.annullamento && {
        ...CONFERMATA.annullamento,
        possibile: false,
        motivo: "scadenza_superata",
        motivoTesto:
          "Non puoi più annullare: la scadenza era il 21 giugno, 23:59. Se non puoi partecipare, avvisa l'organizzazione.",
      },
    },
  },
};
export const Testo200: Story = { decorators: [withText200] };
