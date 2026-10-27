import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { GroupStandings, LiveMatch, LiveSync } from "@/lib/live/types";
import { LiveLoading } from "./live-loading";
import { LiveTappa, LiveTappaSessioneScaduta } from "./live-tappa";

const STAGE = "jesolo";
const ME = "jesolo-M-i1";

const p = (id: string, name: string) => ({ id, name });

function match(over: Partial<LiveMatch> & { id: string }): LiveMatch {
  return {
    court: "Campo 1",
    groupId: "jesolo-M-g1",
    groupLabel: "Girone A",
    home: "Rossi/Bianchi",
    away: "Marino/Greco",
    sets: [],
    stageId: STAGE,
    category: "M",
    round: 1,
    state: "programmata",
    players: {
      home: [p(ME, "Luca Rossi"), p("jesolo-M-i2", "Marco Bianchi")],
      away: [
        p("jesolo-M-i3", "Paolo Marino"),
        p("jesolo-M-i4", "Andrea Greco"),
      ],
    },
    ...over,
  };
}

const matches: LiveMatch[] = [
  match({ id: "a1", state: "conclusa", sets: [[21, 17]] }),
  match({ id: "a2", round: 2, state: "in_corso", sets: [[14, 12]] }),
  match({ id: "a3", round: 3 }),
  match({
    id: "b1",
    court: "Campo 2",
    groupId: "jesolo-M-g2",
    groupLabel: "Girone B",
    state: "in_corso",
    sets: [[9, 11]],
    players: {
      home: [p("b1", "Matteo Ferrari"), p("b2", "Davide Costa")],
      away: [p("b3", "Simone Esposito"), p("b4", "Luca Romano")],
    },
  }),
  match({
    id: "f1",
    court: "Campo 5",
    groupId: "jesolo-F-g1",
    groupLabel: "Girone A",
    category: "F",
    state: "in_corso",
    sets: [[20, 18]],
    players: {
      home: [p("f1", "Giulia Rossi"), p("f2", "Sara Bianchi")],
      away: [p("f3", "Chiara Marino"), p("f4", "Marta Greco")],
    },
  }),
];

const girone: GroupStandings = {
  id: "jesolo-M-g1",
  label: "Girone A",
  stageId: STAGE,
  category: "M",
  rows: [
    ["jesolo-M-i1", "Rossi Luca", 21],
    ["jesolo-M-i2", "Bianchi Marco", 21],
    ["jesolo-M-i3", "Marino Paolo", 17],
    ["jesolo-M-i4", "Greco Andrea", 17],
  ].map(([playerId, pair, points], i) => ({
    position: i < 2 ? 1 : 3,
    pair: pair as string,
    playerId: playerId as string,
    played: 1,
    won: i < 2 ? 1 : 0,
    points: points as number,
  })),
};

const LONG = "Maria Antonietta Brambilla Della Valle Lunghissimo-Cognome";

const longMatches: LiveMatch[] = matches.map((m) =>
  m.id === "b1"
    ? {
        ...m,
        court: "Campo Centrale dello Stadio del Beach Volley",
        groupLabel: "Girone B della fase iniziale",
        sets: [
          [21, 19],
          [19, 21],
          [15, 13],
        ],
        players: {
          home: [p("b1", LONG), p("b2", "Davide Costa")],
          away: [p("b3", "Simone Esposito"), p("b4", LONG)],
        },
      }
    : m,
);

function sync(data: {
  matches: LiveMatch[];
  groups: GroupStandings[];
}): LiveSync {
  return {
    snapshot: {
      seq: 0,
      updatedAt: "2027-06-12T08:05:00.000Z",
      overall: [],
      pendingScores: [],
      ...data,
    },
    syncedAt: "2027-06-12T08:30:00.000Z",
  };
}

type Stato =
  "loading" | "empty" | "offline" | "sessionExpired" | "success" | "longText";

/** w-live in every state, with no connection. */
function LiveTappaScreen({ stato }: { stato: Stato }) {
  if (stato === "loading") return <LiveLoading what="del live della tappa" />;
  if (stato === "sessionExpired") {
    return <LiveTappaSessioneScaduta tappaId={STAGE} />;
  }
  const data =
    stato === "empty"
      ? { matches: [], groups: [] }
      : {
          matches: stato === "longText" ? longMatches : matches,
          groups: [girone],
        };
  return (
    <LiveTappa
      tappaId={STAGE}
      initial={sync(data)}
      me={ME}
      fasi={{ M: "gold", F: "silver" }}
      connect={false}
      initialStatus={stato === "offline" ? "offline" : "live"}
    />
  );
}

const meta = {
  title: "Live/Live della tappa",
  component: LiveTappaScreen,
  args: { stato: "success" },
  argTypes: {
    stato: {
      control: "inline-radio",
      options: [
        "loading",
        "empty",
        "offline",
        "sessionExpired",
        "success",
        "longText",
      ],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LiveTappaScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = { args: { stato: "loading" } };
export const Empty: Story = { args: { stato: "empty" } };
export const Offline: Story = { args: { stato: "offline" } };
export const SessionExpired: Story = { args: { stato: "sessionExpired" } };
export const Success: Story = { args: { stato: "success" } };
export const LongText: Story = { args: { stato: "longText" } };
