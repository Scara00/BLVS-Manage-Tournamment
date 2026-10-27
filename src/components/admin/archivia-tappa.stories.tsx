import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  ANNULLAMENTO_MESSAGES,
  type ArchiviaTappaAction,
} from "@/lib/tappe/annullamento/state";
import { ArchiviaTappa } from "./archivia-tappa";

const archiviaFinto: ArchiviaTappaAction = async () => ({
  status: "success",
  message: ANNULLAMENTO_MESSAGES.archiviata,
  at: 1,
});

const meta = {
  title: "Admin/Archivia tappa",
  component: ArchiviaTappa,
  args: {
    tappaId: "lignano",
    nome: "Tappa 0 · Lignano",
    archiviabile: false,
    archiviata: false,
    action: archiviaFinto,
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="max-w-xs p-inset">
          <Story />
        </div>
        <Toaster />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ArchiviaTappa>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Results not closed yet: disabled, with the note. */
export const Disattivata: Story = {};

/** Both boards concluded: the confirmation dialog. */
export const Abilitata: Story = {
  args: { archiviabile: true, defaultOpen: true },
};

/** loading: never settles. */
export const Caricamento: Story = {
  args: {
    archiviabile: true,
    defaultOpen: true,
    action: () => new Promise(() => {}),
  },
  play: async ({ canvasElement }) => {
    const form = canvasElement.ownerDocument.querySelector(
      "[data-slot=alert-dialog-content] form",
    );
    (form as HTMLFormElement | null)?.requestSubmit();
  },
};

/** The server refused it: results not closed after all. */
export const Rifiutata: Story = {
  args: {
    archiviabile: true,
    defaultOpen: true,
    initialState: {
      status: "error",
      reason: "conflict",
      message: ANNULLAMENTO_MESSAGES.archiviaNonDisponibile,
      at: 1,
    },
  },
};

/** network error. */
export const ErroreRete: Story = {
  args: {
    archiviabile: true,
    defaultOpen: true,
    initialState: {
      status: "error",
      reason: "network",
      message: ANNULLAMENTO_MESSAGES.network,
      at: 1,
    },
  },
};

export const Offline: Story = {
  args: { archiviabile: true, defaultOpen: true, offline: true },
};
