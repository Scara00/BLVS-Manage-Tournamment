import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { giocatoriMisti, partiteMiste } from "@/components/misto/fixtures";
import {
  classificaTappa,
  type FinaleTappa,
} from "@/lib/tappe/classifica/classifica";
import { toStageStandings } from "@/lib/tappe/classifica/live";
import { ClassificaTappaLive } from "./classifica-tappa-live";
import { syncDi, TAPPA } from "./fixtures";

const NOMI: Record<string, string> = {
  A: "Luca Rossi",
  B: "Marco Bianchi",
  C: "Paolo Marino",
  D: "Andrea Greco",
  E: "Giulia Conti",
  F: "Sara Ricci",
  G: "Chiara Romano",
  H: "Elena Gallo",
};

function finale(fase: "gold" | "silver", giocati: number): FinaleTappa {
  const prefisso = `${fase}`;
  return {
    gironeId: `g-${fase}`,
    fase,
    giocatori: giocatoriMisti(prefisso).map((g) => ({
      iscrizioneId: g.iscrizioneId,
      nome: `${NOMI[g.lettera]}${fase === "silver" ? " (S)" : ""}`,
      ritirato: false,
      categoria: g.categoria,
    })),
    partite: partiteMiste(prefisso, { giocati }),
  };
}

function standings(giocatiSilver: number) {
  return toStageStandings(
    classificaTappa({
      finali: [finale("gold", 4), finale("silver", giocatiSilver)],
      concluso: false,
      senzaPunti: true,
    }),
    { tappaId: TAPPA, categoria: "X", nome: "Tappa 3 · Cagliari" },
  );
}

/** w-classifica-tappa on a mixed board: per final, men and women apart. */
function ClassificaMista({
  giocatiSilver,
  me,
}: {
  giocatiSilver: number;
  me: string | null;
}) {
  return (
    <ClassificaTappaLive
      initial={syncDi(standings(giocatiSilver), "2026-07-18T10:05:00.000Z")}
      tappaId={TAPPA}
      categoria="X"
      me={me}
      mostraLaTuaTappa
      connect={false}
      initialStatus="live"
    />
  );
}

const meta = {
  title: "Tappe/w-classifica-tappa · misto",
  component: ClassificaMista,
  args: { giocatiSilver: 4, me: "gold-A" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ClassificaMista>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both finals played: the King and the Queen of the gold final. */
export const Definitiva: Story = {};

/** The silver final still on court: its places are not final yet. */
export const SilverInCorso: Story = {
  args: { giocatiSilver: 2, me: "silver-F" },
};

/** The Queen's own view. */
export const Queen: Story = { args: { me: "gold-G" } };
