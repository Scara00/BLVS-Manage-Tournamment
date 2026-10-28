import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LiveLoading } from "@/components/live/live-loading";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import type { StageStandings } from "@/lib/live/types";
import { ClassificaTappaLive } from "./classifica-tappa-live";
import {
  conclusa,
  definitiva,
  inAttesa,
  inCorso,
  ME,
  parita,
  ritiro,
  syncDi,
  TAPPA,
} from "./fixtures";
import { SceltaCategoriaTappa } from "./scelta-categoria";

const STATI = {
  inCorso,
  definitiva,
  conclusa,
  parita,
  ritiro,
  inAttesa,
} satisfies Record<string, StageStandings>;

/** w-classifica-tappa with fixture data and no connection. */
function ClassificaTappaStory({
  stato,
  me,
  mostraLaTuaTappa,
  status,
  reducedMotion,
}: {
  stato: keyof typeof STATI;
  me: string | null;
  mostraLaTuaTappa: boolean;
  status: LiveStatus;
  reducedMotion?: boolean;
}) {
  return (
    <div className="flex flex-col gap-stack">
      <SceltaCategoriaTappa tappaId={TAPPA} categoria="M" />
      <ClassificaTappaLive
        initial={syncDi(STATI[stato], "2026-07-18T10:05:00.000Z")}
        tappaId={TAPPA}
        categoria="M"
        me={me}
        mostraLaTuaTappa={mostraLaTuaTappa}
        connect={false}
        initialStatus={status}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

const meta = {
  title: "Tappe/w-classifica-tappa",
  component: ClassificaTappaStory,
  args: {
    stato: "inCorso",
    me: ME,
    mostraLaTuaTappa: true,
    status: "live",
  },
  argTypes: {
    stato: { control: "select", options: Object.keys(STATI) },
    status: {
      control: "select",
      options: ["connecting", "live", "reconnecting", "offline"],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ClassificaTappaStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { value: "mobile390", isRotated: false } };

/** Finals on court: silver places «non ancora definitiva», points provisional. */
export const InCorso: Story = {};

/** Every place settled, board still open: points still «provvisori». */
export const PosizioniDefinitive: Story = { args: { stato: "definitiva" } };

/** Board closed: no «provvisori» label left. */
export const Conclusa: Story = { args: { stato: "conclusa" } };

/** A perfect tie the admin has not resolved: shared place and points. */
export const Parita: Story = { args: { stato: "parita", me: "b" } };

/** A withdrawn silver player, last of the final. */
export const Ritiro: Story = { args: { stato: "ritiro" } };

/** No final yet. */
export const InAttesa: Story = { args: { stato: "inAttesa" } };

/** The player is in the silver final. */
export const InSilver: Story = { args: { me: "f" } };

/** Registered on this board but knocked out before the finals. */
export const NonInFinale: Story = {
  args: { stato: "definitiva", me: "fuori" },
};

/** Looking at the other category: no «La tua tappa». */
export const AltroTabellone: Story = {
  args: { mostraLaTuaTappa: false, me: null },
};

/** 390 px: one card per player instead of the table. */
export const Mobile: Story = { globals: mobile };

/** Reduced motion: plain mono digits, no split-flap, no row animation. */
export const MovimentoRidotto: Story = {
  args: { stato: "definitiva", reducedMotion: true },
};

export const Connessione: Story = { args: { status: "connecting" } };

export const Riconnessione: Story = { args: { status: "reconnecting" } };

/** Offline: the data stays, with the time of the last update. */
export const Offline: Story = { args: { status: "offline" } };

/** Suspense fallback while the standing is read. */
export const Caricamento: Story = {
  render: () => <LiveLoading what="della classifica di tappa" />,
};
