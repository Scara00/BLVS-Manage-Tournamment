import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  giocatoriMisti,
  partiteMiste,
  type PartitaMista,
} from "@/components/misto/fixtures";
import type { FaseGirone } from "@/lib/db/types";
import { categorieDa, classificaGirone } from "@/lib/gironi/classifica";
import type { LiveMatch, LiveSync } from "@/lib/live/types";
import { toGroupStandings } from "@/lib/punteggi/format";
import { LiveGirone } from "./live-girone";

const STAGE = "jesolo";
const GIRONE = "jesolo-X-g1";
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
const ME = `${GIRONE}-A`;

const nome = (id: string) => NOMI[id.slice(-1)];

function liveMatch(p: PartitaMista): LiveMatch {
  const giocatori = (lato: "A" | "B") =>
    p.squadre[lato].map((id) => ({ id, name: nome(id) }));
  return {
    id: p.id,
    // The two matches of a turn are on two courts.
    court: Number(p.id.split("-p")[1]) % 2 === 1 ? "Campo 1" : "Campo 2",
    groupId: GIRONE,
    groupLabel: "Girone A",
    home: giocatori("A")
      .map((g) => g.name)
      .join("/"),
    away: giocatori("B")
      .map((g) => g.name)
      .join("/"),
    sets: p.sets.map((s) => [s.a, s.b] as const),
    stageId: STAGE,
    category: "X",
    round: p.turno,
    state: p.stato,
    players: { home: giocatori("A"), away: giocatori("B") },
  };
}

/** The mixed group with its turns up to `giocati` played, `inCorso` on court. */
function sync(giocati: number, inCorso: number | null): LiveSync {
  const partite = partiteMiste(GIRONE, { giocati, inCorso });
  const giocatori = giocatoriMisti(GIRONE);
  const classifica = classificaGirone(
    giocatori.map((g) => g.iscrizioneId),
    partite,
    { categorie: categorieDa(giocatori) },
  );
  const standings = toGroupStandings(
    { id: GIRONE, nome: "Girone A" },
    classifica,
    new Map(giocatori.map((g) => [g.iscrizioneId, NOMI[g.lettera]])),
    { stageId: STAGE, category: "X" },
  );
  return {
    snapshot: {
      seq: 0,
      updatedAt: "2027-06-12T08:05:00.000Z",
      matches: partite.map(liveMatch),
      groups: [standings],
      overall: [],
      pendingScores: [],
    },
    syncedAt: "2027-06-12T08:30:00.000Z",
  };
}

/** w-girone on a mixed board: men and women ranked apart, 2 matches per turn. */
function GironeMisto({
  fase,
  giocati,
  inCorso,
}: {
  fase: FaseGirone;
  giocati: number;
  inCorso: number | null;
}) {
  return (
    <LiveGirone
      tappaId={STAGE}
      girone={{
        id: GIRONE,
        nome: fase === "gold" ? "Gold A" : "Girone A",
        fase,
        gironiDellaFase: 2,
        categoria: "X",
      }}
      initial={sync(giocati, inCorso)}
      me={ME}
      connect={false}
      initialStatus="live"
    />
  );
}

const meta = {
  title: "Live/Pagina del girone · misto",
  component: GironeMisto,
  args: { fase: "iniziale", giocati: 2, inCorso: 3 },
  parameters: { layout: "padded" },
} satisfies Meta<typeof GironeMisto>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Turn 3 on court: its two matches, then two rankings with their line. */
export const InCorso: Story = {};

/** Every match played: 1st and 2nd man and woman go to gold. */
export const Completo: Story = { args: { giocati: 4, inCorso: null } };

/** A gold group: the line marks who reaches the 4 + 4 final. */
export const Gold: Story = {
  args: { fase: "gold", giocati: 4, inCorso: null },
};
