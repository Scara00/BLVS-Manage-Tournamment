import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LiveLoading } from "@/components/live/live-loading";
import {
  classificaDaDati,
  DATI_VUOTI,
  toOverallStandings,
} from "@/lib/classifica-generale/dati";
import type { Categoria } from "@/lib/db/types";
import {
  DEMO_ME_CLASSIFICA,
  demoUtente,
  getDemoDatiClassifica,
} from "@/lib/demo/classifica-generale";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import type { LiveSync, OverallStandings } from "@/lib/live/types";
import { ClassificaGeneraleLive } from "./classifica-generale-live";
import { SceltaCategoria, SceltaStagione } from "./filtri";

type Dati = "provvisoria" | "definitiva" | "vuota";

function standingsDi(
  categoria: Categoria,
  stagione: number,
  dati: Dati,
): OverallStandings {
  if (dati === "vuota") {
    return toOverallStandings(
      classificaDaDati(DATI_VUOTI, categoria, stagione),
    );
  }
  // 2026 has an open stage (provisional), 2025 only closed ones.
  const anno = dati === "provvisoria" ? stagione : 2025;
  return {
    ...toOverallStandings(
      classificaDaDati(getDemoDatiClassifica(categoria, anno), categoria, anno),
    ),
    id: `${categoria}:${stagione}`,
    season: stagione,
  };
}

/** w-classifica with demo data and no connection. */
function Classifica({
  categoria,
  dati,
  me,
  status,
}: {
  categoria: Categoria;
  dati: Dati;
  me: string | null;
  status: LiveStatus;
}) {
  const stagione = 2026;
  const standings = standingsDi(categoria, stagione, dati);
  const initial: LiveSync = {
    snapshot: {
      seq: 0,
      updatedAt: "2026-07-18T10:05:00.000Z",
      matches: [],
      groups: [],
      overall: [],
      pendingScores: [],
      overallStandings: [standings],
    },
    syncedAt: "2026-07-18T10:30:00.000Z",
  };
  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-end justify-between gap-stack">
        <SceltaCategoria categoria={categoria} stagione={stagione} />
        <SceltaStagione
          categoria={categoria}
          stagione={stagione}
          stagioni={[2026, 2025]}
        />
      </div>
      <ClassificaGeneraleLive
        initial={initial}
        standingsId={standings.id}
        categoria={categoria}
        stagione={stagione}
        me={me}
        connect={false}
        initialStatus={status}
      />
    </div>
  );
}

const meta = {
  title: "Classifica generale/w-classifica",
  component: Classifica,
  args: {
    categoria: "M",
    dati: "provvisoria",
    me: DEMO_ME_CLASSIFICA,
    status: "live",
  },
  argTypes: {
    categoria: { control: "inline-radio", options: ["M", "F"] },
    dati: {
      control: "inline-radio",
      options: ["provvisoria", "definitiva", "vuota"],
    },
    status: {
      control: "select",
      options: ["connecting", "live", "reconnecting", "offline"],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof Classifica>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live, points provisional while the last stage is open; «TU» and ties. */
export const PuntiProvvisori: Story = {};

/** Every board closed: no «provvisori» label left. */
export const TuttoDefinitivo: Story = { args: { dati: "definitiva" } };

export const Femminile: Story = {
  args: { categoria: "F", me: demoUtente("F", 3) },
};

/** Signed out: the standing is public, «La tua posizione» invites to sign in. */
export const SenzaAccesso: Story = { args: { me: null } };

/** Signed in but not ranked yet. */
export const FuoriClassifica: Story = { args: { me: "nessuno" } };

/** No stage played yet in the season. */
export const Vuota: Story = { args: { dati: "vuota" } };

export const Connessione: Story = { args: { status: "connecting" } };

export const Riconnessione: Story = { args: { status: "reconnecting" } };

/** Offline: the data stays, with the time of the last update. */
export const Offline: Story = { args: { status: "offline" } };

/** Suspense fallback while the standing is read. */
export const Caricamento: Story = {
  render: () => <LiveLoading what="della classifica" />,
};
