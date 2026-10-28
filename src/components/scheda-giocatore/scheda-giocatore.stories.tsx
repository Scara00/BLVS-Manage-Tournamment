import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LiveLoading } from "@/components/live/live-loading";
import type { Categoria } from "@/lib/db/types";
import {
  DEMO_ANONIMI,
  DEMO_ME_CLASSIFICA,
  demoUtente,
} from "@/lib/demo/classifica-generale";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import { standingsScheda, syncScheda, type DatiScheda } from "./fixtures";
import { SchedaGiocatoreLive } from "./scheda-giocatore-live";

/** w-giocatore with demo data and no connection. */
function Scheda({
  giocatore,
  categoria,
  dati,
  me,
  status,
}: {
  giocatore: string;
  categoria: Categoria;
  dati: DatiScheda;
  me: string | null;
  status: LiveStatus;
}) {
  const standings = standingsScheda(categoria, dati);
  return (
    <SchedaGiocatoreLive
      initial={syncScheda(standings)}
      standingsId={standings.id}
      utenteId={giocatore}
      categoria={categoria}
      stagione={standings.season!}
      me={me}
      connect={false}
      initialStatus={status}
    />
  );
}

const meta = {
  title: "Classifica generale/w-giocatore",
  component: Scheda,
  args: {
    giocatore: DEMO_ME_CLASSIFICA,
    categoria: "M",
    dati: "provvisoria",
    me: DEMO_ME_CLASSIFICA,
    status: "live",
  },
  argTypes: {
    categoria: { control: "inline-radio", options: ["M", "F"] },
    dati: { control: "inline-radio", options: ["provvisoria", "definitiva"] },
    status: {
      control: "select",
      options: ["connecting", "live", "reconnecting", "offline"],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof Scheda>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The player's own card: «TU», gold finals, the open stage provisional. */
export const PuntiProvvisori: Story = {};

/** A season with every board closed: no «provvisori» left. */
export const TuttoDefinitivo: Story = { args: { dati: "definitiva" } };

/** Someone else's card, with silver finals (◆ Finale silver). */
export const Silver: Story = { args: { giocatore: demoUtente("M", 5) } };

/** Knocked out before the finals every time: 0 points, shared place. */
export const NonInFinalePariMerito: Story = {
  args: { giocatore: demoUtente("M", 12) },
};

/** A deleted account: «Giocatore anonimo», results only. */
export const Anonimo: Story = {
  args: { giocatore: [...DEMO_ANONIMI][0] },
};

/** Signed out: the card is public, no «TU». */
export const SenzaAccesso: Story = { args: { me: null } };

export const Femminile: Story = {
  args: { categoria: "F", giocatore: demoUtente("F", 3), me: null },
};

/** The player left the standing after the page opened. */
export const NonPiuInClassifica: Story = { args: { giocatore: "nessuno" } };

export const Riconnessione: Story = { args: { status: "reconnecting" } };

/** Offline: the data stays, with the time of the last update. */
export const Offline: Story = { args: { status: "offline" } };

/** Suspense fallback while the card is read. */
export const Caricamento: Story = {
  render: () => <LiveLoading what="della scheda del giocatore" />,
};
