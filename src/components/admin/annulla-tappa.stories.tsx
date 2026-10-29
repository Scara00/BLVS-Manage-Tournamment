import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  ANNULLAMENTO_MESSAGES,
  type AnnullaTappaAction,
} from "@/lib/tappe/annullamento/state";
import { AnnullaTappa } from "./annulla-tappa";

const annullaFinto: AnnullaTappaAction = async () => ({
  status: "success",
  message:
    "Tappa annullata. Non parte nessuna email: se serve, avvisa tu i 26 iscritti.",
  iscritti: 26,
  at: 1,
});

/** w-admin-annulla-tappa. Open by default so axe sees the dialog. */
const meta = {
  title: "Admin/Annulla tappa",
  component: AnnullaTappa,
  args: {
    tappaId: "rimini",
    nome: "Tappa 2 · Rimini",
    iscritti: 26,
    annullabile: true,
    action: annullaFinto,
    defaultOpen: true,
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="p-inset">
          <Story />
        </div>
        <Toaster />
      </ToastProvider>
    ),
  ],
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/admin" } },
  },
} satisfies Meta<typeof AnnullaTappa>;

export default meta;
type Story = StoryObj<typeof meta>;

/** «26 iscritti vedranno la tappa annullata»; focus on «Non annullare». */
export const Default: Story = {};

/** One player: singular copy. */
export const UnIscritto: Story = { args: { iscritti: 1 } };

/** Nobody registered. */
export const NessunIscritto: Story = { args: { iscritti: 0 } };

/** Submitted without a reason. */
export const MotivoMancante: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "invalid",
      message: ANNULLAMENTO_MESSAGES.invalid,
      fields: { motivo: ANNULLAMENTO_MESSAGES.motivoMancante },
      at: 1,
    },
  },
};

/** loading: never settles, the confirm button shows «Annullamento…». */
export const Caricamento: Story = {
  args: {
    action: () => new Promise(() => {}),
    motivoIniziale: "Allerta meteo: la Capitaneria ha chiuso la spiaggia.",
  },
  play: async ({ canvasElement }) => {
    const form = canvasElement.ownerDocument.querySelector(
      "[data-slot=alert-dialog-content] form",
    );
    (form as HTMLFormElement | null)?.requestSubmit();
  },
};

/** network: the request failed; the reason typed so far stays. */
export const ErroreRete: Story = {
  args: {
    motivoIniziale: "Allerta meteo",
    initialState: {
      status: "error",
      reason: "network",
      message: ANNULLAMENTO_MESSAGES.network,
      fields: {},
      at: 1,
    },
  },
};

/** offline: confirming is disabled, with the reason as text. */
export const Offline: Story = { args: { offline: true } };

export const SessioneScaduta: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "sessionExpired",
      message: ANNULLAMENTO_MESSAGES.sessionExpired,
      fields: {},
      at: 1,
    },
  },
};

export const Testo200: Story = {
  args: {
    nome: "Tappa 5 · Marina di Pietrasanta, Bagno Arcobaleno — Memorial Santamaria-Lombardi",
  },
  parameters: { text200: true },
};
