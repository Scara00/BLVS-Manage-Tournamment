import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { withText200 } from "@/design-system/text-200";
import type {
  CambioCategoriaAction,
  CambioCategoriaState,
} from "@/lib/giocatori/admin/types";
import { CambiaCategoria } from "./cambia-categoria";
import { effettiVersoF } from "./fixtures";

const idle: CambioCategoriaAction = async () => ({ status: "idle" });
const inAttesa: CambioCategoriaAction = () => new Promise(() => {});
const riuscito: CambioCategoriaAction = async () => ({
  status: "success",
  message:
    "Categoria di Luca Rossi cambiata in Femminile. 2 iscrizioni spostate nel tabellone femminile.",
  at: 0,
});

const ERRORI: Record<string, CambioCategoriaState> = {
  effettiCambiati: {
    status: "error",
    reason: "effettiCambiati",
    message:
      "Nel frattempo gli effetti sono cambiati (iscrizioni o posti). Rileggi l'elenco aggiornato e conferma di nuovo.",
    at: 0,
  },
};

/** w-admin-categoria-conferma, open on the change to «Femminile». */
function Screen({
  variante = "completo",
  errore,
  action = idle,
}: {
  variante?: Parameters<typeof effettiVersoF>[0];
  errore?: keyof typeof ERRORI;
  action?: CambioCategoriaAction;
}) {
  return (
    <CambiaCategoria
      utenteId="u5"
      nome="Luca Rossi"
      cambi={[effettiVersoF(variante)]}
      action={action}
      initialAperto="F"
      initialState={errore ? ERRORI[errore] : undefined}
    />
  );
}

const meta = {
  title: "Admin/w-admin-categoria-conferma",
  component: Screen,
  parameters: { nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster />
      </ToastProvider>
    ),
  ],
  argTypes: {
    variante: {
      control: "select",
      options: ["completo", "bloccato", "senzaEffetti"],
    },
    errore: { control: "select", options: [undefined, ...Object.keys(ERRORI)] },
  },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seats (one past the maximum, one leaving a group) and points per season. */
export const Effetti: Story = {};
/** A stage in progress: no confirm button, the reason as text. */
export const Bloccato: Story = { args: { variante: "bloccato" } };
export const SenzaEffetti: Story = { args: { variante: "senzaEffetti" } };
/** The effects changed meanwhile: alert, new effects, confirm again. */
export const EffettiCambiati: Story = { args: { errore: "effettiCambiati" } };
export const Testo200: Story = { decorators: [withText200] };

/** Confirmed, waiting for the server. */
export const InCorso: Story = {
  args: { action: inAttesa },
  play: async () => {
    const dialog = await within(document.body).findByRole("alertdialog");
    await userEvent.click(
      await within(dialog).findByRole("button", {
        name: "Sì, cambia in femminile",
      }),
    );
  },
};

/** Changed: the dialog closes and focus lands on the outcome. */
export const Riuscito: Story = {
  args: { action: riuscito },
  play: InCorso.play,
};
