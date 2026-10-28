import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { userEvent, within } from "storybook/test";
import { withText200 } from "@/design-system/text-200";
import type { AnnullaIscrizioneAction } from "@/lib/iscrizioni/annullamento/state";
import { annullamentoRimini, elenco, STATI_ELENCO } from "./fixtures";
import { MieIscrizioni } from "./mie-iscrizioni";
import {
  MieIscrizioniLoading,
  MieIscrizioniSessioneScaduta,
} from "./mie-iscrizioni-stati";

const idle: AnnullaIscrizioneAction = async () => ({ status: "idle" });

/** Never answers: the dialog stays on «Annullamento…». */
const inAttesa: AnnullaIscrizioneAction = () => new Promise(() => {});

const riuscito: AnnullaIscrizioneAction = async () => ({
  status: "success",
  tappaId: "rimini",
  posto: 12,
  message:
    "Iscrizione a Tappa 2 · Rimini annullata: il posto 12 è di nuovo libero.",
  attempt: 1,
});

/** w-mie-iscrizioni and w-annulla-iscrizione, without data fetching. */
function Screen({
  stato,
  dialog,
  action = idle,
}: {
  stato: (typeof STATI_ELENCO)[number] | "loading" | "sessioneScaduta";
  dialog?: "aperto" | "errore";
  action?: AnnullaIscrizioneAction;
}) {
  if (stato === "loading") return <MieIscrizioniLoading />;
  if (stato === "sessioneScaduta") return <MieIscrizioniSessioneScaduta />;
  return (
    <MieIscrizioni
      vista={elenco(stato)}
      action={action}
      aperta={dialog ? annullamentoRimini() : null}
      initialState={
        dialog === "errore"
          ? {
              status: "error",
              reason: "refused",
              message:
                "Non puoi più annullare: la scadenza era il 21 giugno, 23:59. Se non puoi partecipare, avvisa l'organizzazione.",
              attempt: 1,
            }
          : undefined
      }
    />
  );
}

const meta = {
  title: "Iscrizioni/w-mie-iscrizioni",
  component: Screen,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster />
      </ToastProvider>
    ),
  ],
  args: { stato: "completo" },
  argTypes: {
    stato: {
      control: "select",
      options: [...STATI_ELENCO, "loading", "sessioneScaduta"],
    },
    dialog: { control: "select", options: [undefined, "aperto", "errore"] },
  },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Upcoming (cancellable, past the deadline, cancelled) and past stages. */
export const Completo: Story = {};
export const SoloProssime: Story = { args: { stato: "soloProssime" } };
export const Vuoto: Story = { args: { stato: "vuoto" } };
/** The deadline has passed: no button, the reason in words. */
export const DopoLaScadenza: Story = { args: { stato: "dopoScadenza" } };
export const SenzaStagione: Story = { args: { stato: "senzaStagione" } };
export const Caricamento: Story = { args: { stato: "loading" } };
export const SessioneScaduta: Story = { args: { stato: "sessioneScaduta" } };
export const Testo200: Story = { decorators: [withText200] };

/** w-annulla-iscrizione: focus on «Mantieni l'iscrizione», consequences listed. */
export const DialogAperto: Story = { args: { dialog: "aperto" } };

/** The server refused (deadline passed in the meantime): the reason stays inside. */
export const DialogErrore: Story = { args: { dialog: "errore" } };

/** Confirmed, waiting for the server. */
export const DialogInCorso: Story = {
  args: { dialog: "aperto", action: inAttesa },
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("alertdialog");
    await userEvent.click(
      await within(dialog).findByRole("button", {
        name: "Annulla l'iscrizione",
      }),
    );
  },
};

/** Cancelled: the dialog closes and focus lands on the result message. */
export const DialogRiuscito: Story = {
  args: { dialog: "aperto", action: riuscito },
  play: DialogInCorso.play,
};

export const DialogTesto200: Story = {
  args: { dialog: "aperto" },
  decorators: [withText200],
};
