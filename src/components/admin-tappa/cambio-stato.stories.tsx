import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { GESTIONE_MESSAGES } from "@/lib/tappe/gestione-state";
import { CambioStato } from "./cambio-stato";
import { aperte, bozza, cambiaStatoFinto, testoLungo } from "./stories-data";

/** w-admin-stato-conferma. Open by default so axe sees the dialog. */
const meta = {
  title: "Admin/Conferma cambio stato",
  component: CambioStato,
  args: {
    tappaId: "rimini",
    transizione: bozza.transizione,
    action: cambiaStatoFinto,
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
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/rimini" },
    },
  },
} satisfies Meta<typeof CambioStato>;

export default meta;
type Story = StoryObj<typeof meta>;

/** bozza → aperte: «la tappa diventerà visibile ai giocatori». */
export const Apertura: Story = {};

/** aperte → chiuse, before the deadline. */
export const Chiusura: Story = { args: { transizione: aperte.transizione } };

/** Never settles: the confirm button shows its loading state. */
export const InCorso: Story = {
  args: { action: () => new Promise(() => {}) },
  play: async ({ canvasElement }) => {
    const form = canvasElement.ownerDocument.querySelector(
      "[data-slot=alert-dialog-content] form",
    );
    (form as HTMLFormElement | null)?.requestSubmit();
  },
};

export const Offline: Story = { args: { offline: true } };

export const PermessoNegato: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "permissionDenied",
      message: GESTIONE_MESSAGES.permissionDenied,
      at: 1,
    },
  },
};

export const SessioneScaduta: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "sessionExpired",
      message: GESTIONE_MESSAGES.sessionExpired,
      at: 1,
    },
  },
};

export const ErroreRete: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "network",
      message: GESTIONE_MESSAGES.network,
      at: 1,
    },
  },
};

export const TestoLungo: Story = {
  args: { transizione: testoLungo.transizione },
};

export const Testo200: Story = {
  args: { transizione: testoLungo.transizione },
  parameters: { text200: true },
};
