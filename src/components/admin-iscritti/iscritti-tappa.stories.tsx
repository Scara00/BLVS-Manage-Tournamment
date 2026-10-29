import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type {
  CercaGiocatoriAction,
  IscrittiTappaView,
  ModificaIscrittiAction,
} from "@/lib/iscrizioni/admin/types";
import { IscrittiTappa } from "./iscritti-tappa";
import { giocatoriTrovati, iscrittiDemo } from "./stories-data";

const signOut = async () => ({ error: null });

const azioneFinta: ModificaIscrittiAction = async () => ({
  status: "success",
  message: "Fatto.",
  at: 1,
});

const cercaFinta: CercaGiocatoriAction = async () => ({
  status: "ok",
  giocatori: giocatoriTrovati,
});

type SchermataProps = {
  tappa: IscrittiTappaView;
  caricamento?: boolean;
  rimuoviAperto?: string;
  confermaTutteAperto?: boolean;
};

/** w-admin-iscritti inside the admin shell. */
function Schermata({
  tappa,
  caricamento,
  rimuoviAperto,
  confermaTutteAperto,
}: SchermataProps) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <AppShell variant="admin" signOut={signOut}>
          <PageContainer
            title="Iscritti"
            eyebrow="Amministrazione · Tappe"
            description="Gli iscritti di ogni tabellone con posto e data. Conferma le iscrizioni in attesa (nei gironi entrano solo quelle confermate), aggiungi un giocatore registrato anche a iscrizioni chiuse, rimuovi un iscritto o esporta l'elenco in CSV."
          >
            {caricamento ? (
              <GestioneTappaLoading testo="Caricamento degli iscritti…" />
            ) : (
              <IscrittiTappa
                tappa={tappa}
                aggiungi={azioneFinta}
                rimuovi={azioneFinta}
                conferma={azioneFinta}
                cerca={cercaFinta}
                rimuoviAperto={rimuoviAperto}
                confermaTutteAperto={confermaTutteAperto}
              />
            )}
          </PageContainer>
        </AppShell>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

const meta = {
  title: "Admin/Iscritti tappa",
  component: Schermata,
  args: { tappa: iscrittiDemo() },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/rimini/iscritti" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Registrations closed: the admin can still add and remove, and confirm
 * the pending ones (every 4th seat) one by one or all together.
 */
export const Elenco: Story = {};

/** «Conferma tutte», open: how many and what it means for the groups. */
export const ConfermaTutte: Story = { args: { confermaTutteAperto: true } };

export const Vuoto: Story = {
  args: { tappa: iscrittiDemo({ stato: "iscrizioni_aperte", m: 0, f: 0 }) },
};

/** «NESSUN POSTO LIBERO» on the men's board. */
export const TabellonePieno: Story = {
  args: { tappa: iscrittiDemo({ posti: 6, m: 6 }) },
};

/** Stage in progress: no add or remove, the export stays. */
export const SolaLettura: Story = {
  args: { tappa: iscrittiDemo({ stato: "in_corso" }) },
};

export const Archiviata: Story = {
  args: { tappa: iscrittiDemo({ stato: "archiviata" }) },
};

export const Caricamento: Story = { args: { caricamento: true } };

/** The removal confirmation, open for seat 1. */
export const ConfermaRimozione: Story = { args: { rimuoviAperto: "M-1" } };

export const Testo200: Story = { parameters: { text200: true } };
