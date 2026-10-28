import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { ANNULLA_ISCRIZIONE_INITIAL } from "@/lib/iscrizioni/annullamento/state";
import { PRENDI_POSTO_INITIAL } from "@/lib/iscrizioni/prendi-posto-state";
import { withText200 } from "@/design-system/text-200";
import { STATI_DETTAGLIO, dettaglio, type StatoDettaglio } from "./fixtures";
import { TappaDettaglioView } from "./tappa-dettaglio";
import { TappaLoading } from "./tappa-loading";

const noop = async () => PRENDI_POSTO_INITIAL;
const annulla = async () => ANNULLA_ISCRIZIONE_INITIAL;

/** w-tappa in every state, without data fetching. */
function DettaglioScreen({ stato }: { stato: StatoDettaglio | "loading" }) {
  if (stato === "loading") return <TappaLoading />;
  return (
    <TappaDettaglioView
      tappa={dettaglio(stato)}
      action={noop}
      annulla={annulla}
    />
  );
}

const meta = {
  title: "Tappa/Dettaglio",
  component: DettaglioScreen,
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
  args: { stato: "aperta" },
  argTypes: {
    stato: { control: "select", options: [...STATI_DETTAGLIO, "loading"] },
  },
} satisfies Meta<typeof DettaglioScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Aperta: Story = {};
export const Chiusa: Story = { args: { stato: "chiusa" } };
export const Scaduta: Story = { args: { stato: "scaduta" } };
export const Esaurita: Story = { args: { stato: "esaurita" } };
export const Annullata: Story = { args: { stato: "annullata" } };
export const GiaIscritto: Story = { args: { stato: "giaIscritto" } };
export const SenzaCategoria: Story = { args: { stato: "senzaCategoria" } };
export const InCorso: Story = { args: { stato: "inCorso" } };
export const Caricamento: Story = { args: { stato: "loading" } };
export const Testo200: Story = {
  args: { stato: "esaurita" },
  decorators: [withText200],
};
