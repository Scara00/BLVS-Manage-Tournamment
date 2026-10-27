import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type {
  CercaGiocatoriAction,
  ModificaIscrittiAction,
} from "@/lib/iscrizioni/admin/types";
import { AggiungiGiocatoreDialog } from "./aggiungi-giocatore-dialog";
import { giocatoriTrovati, iscrittiDemo } from "./stories-data";

const cercaFinta: CercaGiocatoriAction = async () => ({
  status: "ok",
  giocatori: giocatoriTrovati,
});

const aggiungiFinta: ModificaIscrittiAction = async () => ({
  status: "success",
  message: "Rossetti Lorenzo ora ha il posto 7.",
  at: 1,
});

const risultati = {
  stato: "esito",
  esito: { status: "ok", giocatori: giocatoriTrovati },
} as const;

/** w-admin-aggiungi-giocatore. Open by default so axe sees the dialog. */
const meta = {
  title: "Admin/Aggiungi giocatore",
  component: AggiungiGiocatoreDialog,
  args: {
    tappaId: "rimini",
    tabelloni: iscrittiDemo().tabelloni,
    cerca: cercaFinta,
    action: aggiungiFinta,
    defaultOpen: true,
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster />
      </ToastProvider>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/rimini/iscritti" },
    },
  },
} satisfies Meta<typeof AggiungiGiocatoreDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Just opened: an empty search. */
export const Vuota: Story = {};

export const TroppoCorta: Story = {
  args: { initialQuery: "r", initialRicerca: { stato: "corta" } },
};

export const RicercaInCorso: Story = {
  args: { initialQuery: "ros", initialRicerca: { stato: "inCorso" } },
};

/** Results, with the reason why some cannot be added. */
export const Risultati: Story = {
  args: { initialQuery: "ros", initialRicerca: risultati },
};

export const NessunRisultato: Story = {
  args: {
    initialQuery: "zzz",
    initialRicerca: { stato: "esito", esito: { status: "ok", giocatori: [] } },
  },
};

export const ErroreRicerca: Story = {
  args: {
    initialQuery: "ros",
    initialRicerca: {
      stato: "esito",
      esito: {
        status: "error",
        message:
          "La ricerca non è riuscita: controlla la connessione e riprova.",
      },
    },
  },
};

/** Both boards full: the warning and every result blocked. */
export const TabelloniPieni: Story = {
  args: {
    tabelloni: iscrittiDemo({ posti: 6, m: 6, f: 6 }).tabelloni,
    initialQuery: "ros",
    initialRicerca: risultati,
  },
};

/** The server refused (someone took the last seat in the meantime). */
export const ErroreAggiunta: Story = {
  args: {
    initialQuery: "ros",
    initialRicerca: risultati,
    initialState: {
      status: "error",
      reason: "invalid",
      message:
        "Posti esauriti in questo tabellone: libera un posto prima di aggiungere.",
      at: 1,
    },
  },
};

export const SessioneScaduta: Story = {
  args: {
    initialQuery: "ros",
    initialRicerca: risultati,
    initialState: {
      status: "error",
      reason: "sessionExpired",
      message: "La sessione è scaduta: accedi di nuovo per continuare.",
      at: 1,
    },
  },
};

/** Never settles: the chosen «Aggiungi» shows its loading state. */
export const AggiuntaInCorso: Story = {
  args: {
    initialQuery: "ros",
    initialRicerca: risultati,
    action: () => new Promise(() => {}),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.ownerDocument.querySelector<HTMLButtonElement>(
      '[data-giocatore="g1"] button',
    );
    button?.click();
  },
};

export const Testo200: Story = {
  args: { initialQuery: "ros", initialRicerca: risultati },
  decorators: [withText200],
};
