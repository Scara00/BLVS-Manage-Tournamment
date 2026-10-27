import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { erroreConferma } from "@/lib/gironi/rigenera/format";
import {
  RIGENERA_MESSAGES,
  type RigeneraAction,
} from "@/lib/gironi/rigenera/types";
import { RigeneraGironi } from "./rigenera-gironi";
import { punteggiPersiDemo, rigenerazioneDemo } from "./stories-rigenera";

/** Succeeds after a short pause, like the demo store. */
const rigeneraFinto: RigeneraAction = async (prev, formData) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const persi = Number(formData.get("attesi"));
  return {
    status: "success",
    persi,
    gironi: 4,
    message:
      persi === 0
        ? "Gironi rigenerati: 4 gironi."
        : `Gironi rigenerati: 4 gironi. Persi ${persi} punteggi, annotati nel registro.`,
    at: prev.status === "idle" ? 1 : prev.at + 1,
  };
};

/**
 * w-admin-rigenera-conferma, in w-admin-gironi. Open by default so axe
 * sees the confirmation.
 */
const meta = {
  title: "Admin/Rigenera gironi",
  component: RigeneraGironi,
  args: {
    rigenerazione: rigenerazioneDemo(),
    rigenera: rigeneraFinto,
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
      navigation: { pathname: "/admin/tappe/jesolo/gironi/m" },
    },
  },
} satisfies Meta<typeof RigeneraGironi>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Scores entered: how many and which are lost, plus the box to tick. */
export const ConPunteggi: Story = {};

/** No score: the button regenerates at once, there is no dialog. */
export const SenzaPunteggi: Story = {
  args: { rigenerazione: rigenerazioneDemo([]), defaultOpen: false },
};

/** One score only: singular copy. */
export const UnPunteggio: Story = {
  args: { rigenerazione: rigenerazioneDemo(punteggiPersiDemo.slice(0, 1)) },
};

/** Request in flight: the confirm button shows its loading state. */
export const Loading: Story = { args: { loading: true } };

/** Direct regeneration in flight. */
export const LoadingDiretta: Story = {
  args: {
    rigenerazione: rigenerazioneDemo([]),
    defaultOpen: false,
    loading: true,
  },
};

/** Confirmed without the tick: the error sits next to the box. */
export const FieldErrors: Story = {
  args: {
    initialState: {
      status: "fieldErrors",
      fields: { conferma: erroreConferma(punteggiPersiDemo.length) },
      at: 1,
    },
  },
};

/** A score arrived while the dialog was open. */
export const PunteggiCambiati: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "conflict",
      message:
        "Nel frattempo i punteggi sono cambiati: ora se ne perdono 3. Controlla l'elenco e conferma di nuovo.",
      at: 1,
    },
  },
};

export const SessioneScaduta: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "sessionExpired",
      message: RIGENERA_MESSAGES.sessionExpired,
      at: 1,
    },
  },
};

export const Offline: Story = { args: { offline: true } };

export const Testo200: Story = { parameters: { text200: true } };
