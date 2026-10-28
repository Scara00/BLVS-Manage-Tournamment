import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionExpiredView } from "@/components/auth/session-expired-view";
import { ForbiddenContent } from "@/components/error-page";
import { AppShell } from "@/components/layout/app-shell";
import { MinimalShell } from "@/components/layout/minimal-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveLoading,
  LiveProvider,
} from "@/components/live";
import {
  demoAdminTappa,
  partiteDaInserireOggi,
  type AdminTappa,
  type FiltroStato,
} from "@/lib/admin/tappe";
import { demoAdminStages } from "@/lib/demo/tournament";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import { demoLiveSnapshot } from "@/lib/live/seed";
import { AdminTappeLoading } from "./admin-tappe-loading";
import { AdminTappeSection } from "./admin-tappe-section";
import { PendingScoresBanner } from "./pending-scores-banner";
import type { AzioniTappe } from "./tappe-table";

const signOut = async () => ({ error: null });

/** BLVS-22 actions: never settle, nothing to save in Storybook. */
const azioniFinte: AzioniTappe = {
  annulla: () => new Promise(() => {}),
  archivia: () => new Promise(() => {}),
  elimina: () => new Promise(() => {}),
};

const initial = {
  snapshot: demoLiveSnapshot("2026-06-14T08:05:00.000Z"),
  syncedAt: "2026-06-14T08:30:00.000Z",
};

const demo = demoAdminStages.map(demoAdminTappa);

const longText: AdminTappa[] = [
  {
    ...demo[1],
    id: "lungo",
    nome: "Tappa 5 · Marina di Pietrasanta, Bagno Arcobaleno — Memorial Giovanni Battista Santamaria-Lombardi",
    periodo: "31 dicembre 2026 – 1 gennaio 2027",
    stato: "iscrizioni_chiuse",
  },
  ...demo,
];

type Stato =
  | "pronto"
  | "caricamento"
  | "vuoto"
  | "offline"
  | "accessoNegato"
  | "sessioneScaduta";

/** w-admin-dashboard in its states, with demo data and no connection. */
function Schermata({
  stato = "pronto",
  tappe = demo,
  filtro = "tutte",
}: {
  stato?: Stato;
  tappe?: AdminTappa[];
  filtro?: FiltroStato;
}) {
  if (stato === "sessioneScaduta") {
    return (
      <div className="flex min-h-screen flex-col">
        <MinimalShell back={false}>
          <SessionExpiredView
            destination="Admin · Dashboard"
            returnPath="/admin"
            loginHref="/accesso?da=%2Fadmin&motivo=scaduta"
            drafts={[]}
          />
        </MinimalShell>
      </div>
    );
  }
  if (stato === "accessoNegato") {
    return (
      <div className="flex min-h-screen flex-col">
        <AppShell variant="player" signOut={signOut}>
          <ForbiddenContent currentRole="giocatore" requiredRole="admin" />
        </AppShell>
      </div>
    );
  }

  const visibili = stato === "vuoto" ? [] : tappe;
  const oggi = partiteDaInserireOggi(visibili);
  const liveStatus: LiveStatus = stato === "offline" ? "offline" : "live";
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="admin" signOut={signOut}>
        <PageContainer
          title="Dashboard"
          eyebrow="Amministrazione"
          description="Riepilogo del circuito e delle attività in attesa."
        >
          {stato === "caricamento" ? (
            <>
              <LiveLoading what="delle partite da inserire" />
              <AdminTappeLoading />
            </>
          ) : (
            <>
              {oggi.length > 0 ? (
                <LiveProvider
                  initial={initial}
                  connect={false}
                  initialStatus={liveStatus}
                >
                  <div className="flex flex-col gap-stack-sm">
                    <PendingScoresBanner initial={oggi} />
                    <LiveBarConnected />
                    <LiveAnnouncer types={["pending-scores"]} />
                  </div>
                </LiveProvider>
              ) : null}
              <AdminTappeSection
                tappe={visibili}
                filtro={filtro}
                basePath="/admin"
                azioni={azioniFinte}
              />
            </>
          )}
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Amministrazione/Dashboard",
  component: Schermata,
  args: { stato: "pronto", filtro: "tutte" },
  // The stage actions (BLVS-22) toast their outcome; no root layout here.
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster />
      </ToastProvider>
    ),
  ],
  argTypes: {
    stato: {
      control: "inline-radio",
      options: [
        "pronto",
        "caricamento",
        "vuoto",
        "offline",
        "accessoNegato",
        "sessioneScaduta",
      ],
    },
    tappe: { control: false },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/admin" } },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FiltroBozze: Story = { args: { filtro: "bozza" } };

export const Loading: Story = { args: { stato: "caricamento" } };

export const Empty: Story = { args: { stato: "vuoto" } };

export const Offline: Story = { args: { stato: "offline" } };

export const PermissionDenied: Story = {
  args: { stato: "accessoNegato" },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/admin" } },
  },
};

export const SessionExpired: Story = {
  args: { stato: "sessioneScaduta" },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/sessione-scaduta" },
    },
  },
};

export const LongText: Story = { args: { tappe: longText } };

export const LongText200: Story = {
  args: { tappe: longText },
  parameters: { text200: true },
};
