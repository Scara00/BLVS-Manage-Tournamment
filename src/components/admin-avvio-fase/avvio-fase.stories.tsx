import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { AvvioFaseView } from "@/lib/tappe/avvio/format";
import type { AvvioFaseState } from "@/lib/tappe/avvio/state";
import { AvvioFase } from "./avvio-fase";
import {
  avviaFinta,
  avviata,
  bloccata,
  erroriServer,
  nomiLunghi,
  pronta,
} from "./stories-data";

const signOut = async () => ({ error: null });

type SchermataProps = {
  view: AvvioFaseView;
  caricamento?: boolean;
  defaultOpen?: boolean;
  offline?: boolean;
  initialState?: AvvioFaseState;
};

/** w-admin-avvio-fase inside the admin shell. */
function Schermata({
  view,
  caricamento,
  defaultOpen,
  offline,
  initialState,
}: SchermataProps) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <AppShell variant="admin" signOut={signOut}>
          <PageContainer
            title="Avvio fase"
            eyebrow="Amministrazione · Tappe"
            description="Controlla i gironi e crea le partite dei gironi iniziali, un tabellone alla volta."
          >
            {caricamento ? (
              <GestioneTappaLoading testo="Caricamento dei gironi…" />
            ) : (
              <AvvioFase
                view={view}
                action={avviaFinta}
                defaultOpen={defaultOpen}
                offline={offline}
                initialState={initialState}
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
  title: "Admin/Avvio fase",
  component: Schermata,
  args: { view: pronta },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/cagliari/avvio/m" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three full groups: every check passes, the start asks for confirmation. */
export const Pronta: Story = {};

/** The confirmation: what is created and what changes. */
export const Conferma: Story = { args: { defaultOpen: true } };

/** Known problems: the checks fail and each error links to its group. */
export const Bloccata: Story = { args: { view: bloccata } };

/** The server refused the start: the errors are announced and focused. */
export const FieldErrors: Story = {
  args: {
    view: bloccata,
    initialState: {
      status: "fieldErrors",
      errori: erroriServer,
      message: "La fase non è partita: correggi i gironi indicati e riprova.",
      at: 1,
    },
  },
};

/** The page while the groups are read (Suspense fallback). */
export const Loading: Story = { args: { caricamento: true } };

/** Already started: the matches created, no button. */
export const Avviata: Story = { args: { view: avviata } };

/** No network: the button stays focusable but blocked, with the reason. */
export const Offline: Story = { args: { offline: true } };

export const Testo200: Story = {
  args: { view: nomiLunghi },
  parameters: { text200: true },
};
