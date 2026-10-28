import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LiveLoading } from "@/components/live/live-loading";
import { LiveTappaSessioneScaduta } from "@/components/live/live-tappa";
import type { FaseGirone } from "@/lib/db/types";
import type {
  GroupStandingRow,
  GroupStandings,
  LiveMatch,
  LiveSync,
} from "@/lib/live/types";
import { gironeTappaHref } from "@/lib/tappe/paths";
import { LiveGirone } from "./live-girone";

const STAGE = "jesolo";
const GIRONE = "jesolo-M-g1";
const ME = "jesolo-M-i1";

const p = (id: string, name: string) => ({ id, name });
const LONG = "Maria Antonietta Brambilla Della Valle Lunghissimo-Cognome";

const giocatori = {
  i1: p(ME, "Luca Rossi"),
  i2: p("jesolo-M-i2", "Marco Bianchi"),
  i3: p("jesolo-M-i3", "Paolo Marino"),
  i4: p("jesolo-M-i4", "Andrea Greco"),
};
const { i1, i2, i3, i4 } = giocatori;

/** The King/Queen rotation: AB–CD, AC–BD, AD–BC. */
const coppie = [
  [
    [i1, i2],
    [i3, i4],
  ],
  [
    [i1, i3],
    [i2, i4],
  ],
  [
    [i1, i4],
    [i2, i3],
  ],
];

function turno(round: number, over: Partial<LiveMatch> = {}): LiveMatch {
  const [home, away] = coppie[round - 1];
  return {
    id: `${GIRONE}-t${round}`,
    court: "Campo 1",
    groupId: GIRONE,
    groupLabel: "Girone A",
    home: home.map((x) => x.name).join("/"),
    away: away.map((x) => x.name).join("/"),
    sets: [],
    stageId: STAGE,
    category: "M",
    round,
    state: "programmata",
    players: { home, away },
    ...over,
  };
}

function riga(
  [playerId, pair]: [string, string],
  position: number,
  played: number,
  won: number,
  points: number,
  against: number,
  note?: string,
): GroupStandingRow {
  return {
    position,
    pair,
    playerId,
    played,
    won,
    points,
    against,
    diff: points - against,
    ...(note ? { note } : {}),
  };
}

const nomi: Record<string, [string, string]> = {
  i1: [ME, "Rossi Luca"],
  i2: ["jesolo-M-i2", "Bianchi Marco"],
  i3: ["jesolo-M-i3", "Marino Paolo"],
  i4: ["jesolo-M-i4", "Greco Andrea"],
};

const standing = (rows: GroupStandingRow[]): GroupStandings => ({
  id: GIRONE,
  label: "Girone A",
  stageId: STAGE,
  category: "M",
  rows,
});

type Stato =
  | "loading"
  | "sessionExpired"
  | "inAttesa"
  | "inCorso"
  | "parziale"
  | "completo"
  | "paritaSullaLinea"
  | "ritiro"
  | "spettatore"
  | "gold"
  | "offline"
  | "testoLungo";

function scenario(stato: Stato): {
  matches: LiveMatch[];
  rows: GroupStandingRow[];
} {
  const zero = (["i1", "i2", "i3", "i4"] as const).map((k) =>
    riga(nomi[k], 1, 0, 0, 0, 0),
  );
  const dopoUno = [
    riga(nomi.i1, 1, 1, 1, 21, 17),
    riga(nomi.i2, 1, 1, 1, 21, 17),
    riga(nomi.i3, 3, 1, 0, 17, 21),
    riga(nomi.i4, 3, 1, 0, 17, 21),
  ];
  const t1 = turno(1, { state: "conclusa", sets: [[21, 17]] });
  switch (stato) {
    case "inAttesa":
      return { matches: [turno(1), turno(2), turno(3)], rows: zero };
    case "parziale":
      return {
        matches: [
          t1,
          turno(2, {
            state: "in_corso",
            partial: {
              home: 14,
              away: 11,
              updatedAt: "2027-06-12T08:28:00.000Z",
            },
          }),
          turno(3),
        ],
        rows: dopoUno,
      };
    case "completo":
      return {
        matches: [
          t1,
          turno(2, { state: "conclusa", sets: [[21, 15]] }),
          turno(3, { state: "conclusa", sets: [[23, 21]] }),
        ],
        rows: [
          riga(nomi.i1, 1, 3, 3, 65, 53),
          riga(nomi.i2, 2, 3, 1, 59, 61),
          riga(nomi.i3, 3, 3, 1, 57, 61),
          riga(nomi.i4, 4, 3, 1, 53, 59),
        ],
      };
    case "paritaSullaLinea":
      return {
        matches: [
          t1,
          turno(2, { state: "conclusa", sets: [[15, 21]] }),
          turno(3, { state: "conclusa", sets: [[21, 19]] }),
        ],
        rows: [
          riga(nomi.i1, 1, 3, 2, 57, 57),
          riga(nomi.i2, 2, 3, 2, 57, 55),
          riga(nomi.i4, 2, 3, 2, 57, 55),
          riga(nomi.i3, 4, 3, 0, 55, 59),
        ],
      };
    case "ritiro":
      return {
        matches: [t1, turno(2, { state: "annullata" }), turno(3)],
        rows: [...dopoUno.slice(0, 3), { ...dopoUno[3], note: "Ritirato" }],
      };
    default:
      return {
        matches: [t1, turno(2, { state: "in_corso", sets: [] }), turno(3)],
        rows: dopoUno,
      };
  }
}

function sync(matches: LiveMatch[], rows: GroupStandingRow[]): LiveSync {
  return {
    snapshot: {
      seq: 0,
      updatedAt: "2027-06-12T08:05:00.000Z",
      matches,
      groups: [standing(rows)],
      overall: [],
      pendingScores: [],
    },
    syncedAt: "2027-06-12T08:30:00.000Z",
  };
}

/** w-girone in every state, with no connection. */
function GironeScreen({
  stato,
  reducedMotion,
}: {
  stato: Stato;
  reducedMotion?: boolean;
}) {
  if (stato === "loading") return <LiveLoading what="del girone" />;
  if (stato === "sessionExpired") {
    return (
      <LiveTappaSessioneScaduta
        tappaId={STAGE}
        ritorno={gironeTappaHref(STAGE, GIRONE)}
      />
    );
  }
  let { matches, rows } = scenario(stato);
  if (stato === "testoLungo") {
    matches = matches.map((m) => ({
      ...m,
      court: "Campo Centrale dello Stadio del Beach Volley",
      players: {
        home: [p(ME, LONG), m.players!.home[1]],
        away: m.players!.away,
      },
    }));
    rows = rows.map((r) => (r.playerId === ME ? { ...r, pair: LONG } : r));
  }
  const fase: FaseGirone = stato === "gold" ? "gold" : "iniziale";
  return (
    <LiveGirone
      tappaId={STAGE}
      girone={{
        id: GIRONE,
        nome: stato === "gold" ? "Gold A" : "Girone A",
        fase,
        gironiDellaFase: 2,
      }}
      initial={sync(matches, rows)}
      me={stato === "spettatore" ? null : ME}
      connect={false}
      initialStatus={stato === "offline" ? "offline" : "live"}
      reducedMotion={reducedMotion}
    />
  );
}

const STATI: Stato[] = [
  "loading",
  "sessionExpired",
  "inAttesa",
  "inCorso",
  "parziale",
  "completo",
  "paritaSullaLinea",
  "ritiro",
  "spettatore",
  "gold",
  "offline",
  "testoLungo",
];

const meta = {
  title: "Live/Pagina del girone",
  component: GironeScreen,
  args: { stato: "inCorso" },
  argTypes: {
    stato: { control: "select", options: STATI },
    reducedMotion: { control: "boolean" },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof GironeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = { args: { stato: "loading" } };
export const SessionExpired: Story = { args: { stato: "sessionExpired" } };
/** No match played yet: everyone level at 0. */
export const InAttesa: Story = { args: { stato: "inAttesa" } };
/** A match on court, the first one played. */
export const InCorso: Story = { args: { stato: "inCorso" } };
/** BLVS-37: the match on court has a partial. */
export const Parziale: Story = { args: { stato: "parziale" } };
export const Completo: Story = { args: { stato: "completo" } };
/** Two players level on 2nd place: the tie sits on the cut line. */
export const ParitaSullaLinea: Story = { args: { stato: "paritaSullaLinea" } };
/** BLVS-42: a withdrawn player, a voided match. */
export const Ritiro: Story = { args: { stato: "ritiro" } };
/** A visitor not in the group: no «Tu». */
export const Spettatore: Story = { args: { stato: "spettatore" } };
/** A gold group: the line marks who reaches the gold final. */
export const GironeGold: Story = { args: { stato: "gold" } };
export const Offline: Story = { args: { stato: "offline" } };
export const TestoLungo: Story = { args: { stato: "testoLungo" } };
/** prefers-reduced-motion: no flash, no sliding rows, no flap. */
export const MovimentoRidotto: Story = {
  args: { stato: "parziale", reducedMotion: true },
};
