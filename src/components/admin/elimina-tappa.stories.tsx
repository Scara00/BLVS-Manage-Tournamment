import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  ELIMINAZIONE_MESSAGES,
  type EliminaTappaAction,
} from "@/lib/tappe/eliminazione/state";
import { EliminaTappa } from "./elimina-tappa";

const eliminaFinto: EliminaTappaAction = async () => ({
  status: "success",
  message: "Tappa «Tappa 2 · Rimini» eliminata.",
  at: 1,
});

/** «Elimina tappa». Open by default so axe sees the dialog. */
const meta = {
  title: "Admin/Elimina tappa",
  component: EliminaTappa,
  args: {
    tappaId: "rimini",
    nome: "Tappa 2 · Rimini",
    iscritti: 26,
    conRisultati: true,
    action: eliminaFinto,
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
    nextjs: { appDirectory: true, navigation: { pathname: "/admin/tappe" } },
  },
} satisfies Meta<typeof EliminaTappa>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A played stage: registrations and points go; focus on «Non eliminare». */
export const Default: Story = {};

/** A draft with nobody registered. */
export const Bozza: Story = { args: { iscritti: 0, conRisultati: false } };

/** Confirmed without typing ELIMINA. */
export const ConfermaMancante: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "invalid",
      message: ELIMINAZIONE_MESSAGES.invalid,
      fields: { conferma: ELIMINAZIONE_MESSAGES.confermaMancante },
      at: 1,
    },
  },
};

/** The request failed: the error is announced in the dialog. */
export const ErroreRete: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "network",
      message: ELIMINAZIONE_MESSAGES.network,
      fields: {},
      at: 1,
    },
  },
};

/** No connection: confirming is disabled, with the reason as text. */
export const Offline: Story = { args: { offline: true } };
