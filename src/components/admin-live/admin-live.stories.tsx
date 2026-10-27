import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { LiveBarConnected, LiveProvider } from "@/components/live";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import type { AzionePartitaState } from "@/lib/tappe/live-admin/state";
import type { TabelloneLive } from "@/lib/tappe/live-admin/types";
import { AdminLive } from "./admin-live";
import { AdminLiveLoading } from "./admin-live-loading";
import {
  appenaAvviata,
  azioneFinta,
  inGara,
  liveSync,
  nonAvviata,
} from "./stories-data";

const signOut = async () => ({ error: null });

type SchermataProps = {
  view: TabelloneLive;
  caricamento?: boolean;
  offline?: boolean;
  stato?: LiveStatus;
  initialState?: AzionePartitaState;
};

/** w-admin-live inside the admin shell, with the live bar. */
function Schermata({
  view,
  caricamento,
  offline,
  stato = "live",
  initialState,
}: SchermataProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="admin" signOut={signOut}>
        <PageContainer
          title="Gestione live"
          eyebrow="Amministrazione · Tappe"
          description="Le partite in corso, tutte le partite per fase e girone e l'avanzamento della fase, aggiornati in tempo reale."
        >
          {caricamento ? (
            <AdminLiveLoading />
          ) : (
            <LiveProvider
              initial={liveSync}
              connect={false}
              initialStatus={stato}
            >
              <div className="flex flex-col gap-stack">
                <LiveBarConnected />
                <AdminLive
                  view={view}
                  azione={azioneFinta}
                  punteggio={azioneFinta}
                  offline={offline}
                  initialState={initialState}
                />
              </div>
            </LiveProvider>
          )}
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Admin/Gestione live",
  component: Schermata,
  args: { view: inGara },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/live/m" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-race: matches in progress as cards, due results on tape. */
export const Success: Story = {};

/** Right after «Avvia le N partite»: everything «da giocare». */
export const AppenaAvviata: Story = { args: { view: appenaAvviata } };

/** The page while the matches are read (Suspense fallback). */
export const Loading: Story = { args: { caricamento: true } };

/** The phase is not started yet: a link to the start screen. */
export const Empty: Story = { args: { view: nonAvviata } };

/** No network: actions stopped with the reason, live bar offline. */
export const Offline: Story = { args: { offline: true, stato: "offline" } };

/** An action found the session expired: «Accedi di nuovo». */
export const SessionExpired: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "sessionExpired",
      message: "La sessione è scaduta: accedi di nuovo per continuare.",
      at: 1,
    },
  },
};

export const Testo200: Story = { parameters: { text200: true } };
