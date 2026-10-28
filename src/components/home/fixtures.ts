import type { Home, HomeGara, HomeProssima } from "@/lib/home/types";
import type { GroupStandings, LiveMatch, LiveSync } from "@/lib/live/types";
import type { TappaGiocatore } from "@/lib/tappe/format";

/*
 * w-home fixtures (BLVS-52) for stories and component tests. The player is
 * the demo «Luca Rossi», men's seat 1 of Jesolo, as on w-live.
 */

const STAGE = "jesolo";
export const ME = "jesolo-M-i1";

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

export const partite: LiveMatch[] = [
  match({ id: "a1", state: "conclusa", sets: [[21, 17]] }),
  match({
    id: "a2",
    round: 2,
    court: "Campo 3",
    state: "in_corso",
    sets: [[14, 12]],
    players: {
      home: [p(ME, "Luca Rossi"), p("jesolo-M-i3", "Paolo Marino")],
      away: [
        p("jesolo-M-i2", "Marco Bianchi"),
        p("jesolo-M-i4", "Andrea Greco"),
      ],
    },
  }),
  match({ id: "a3", round: 3 }),
];

export const girone: GroupStandings = {
  id: "jesolo-M-g1",
  label: "Girone A",
  stageId: STAGE,
  category: "M",
  rows: [
    ["jesolo-M-i1", "Rossi Luca", 21, 1],
    ["jesolo-M-i2", "Bianchi Marco", 21, 1],
    ["jesolo-M-i3", "Marino Paolo", 17, 3],
    ["jesolo-M-i4", "Greco Andrea", 17, 3],
  ].map(([playerId, pair, points, position]) => ({
    position: position as number,
    pair: pair as string,
    playerId: playerId as string,
    played: 1,
    won: position === 1 ? 1 : 0,
    points: points as number,
  })),
};

function sync(data: {
  matches: LiveMatch[];
  groups: GroupStandings[];
}): LiveSync {
  return {
    snapshot: {
      seq: 0,
      updatedAt: "2027-06-14T08:05:00.000Z",
      overall: [],
      pendingScores: [],
      ...data,
    },
    syncedAt: "2027-06-14T08:30:00.000Z",
  };
}

export const gara: HomeGara = {
  tipo: "gara",
  tappa: { id: STAGE, nome: "Tappa 1 · Jesolo" },
  sync: sync({ matches: partite, groups: [girone] }),
  me: ME,
  fasi: { M: "gold", F: "silver" },
  categoria: "M",
  generale: {
    playerId: "demo-u-m-01",
    name: "Luca Rossi",
    position: 4,
    points: 20,
    stages: 2,
    provisional: true,
    tied: false,
  },
};

/** My match in progress with a partial score (BLVS-37). */
export const garaParziale: HomeGara = {
  ...gara,
  sync: sync({
    matches: partite.map((m) =>
      m.id === "a2"
        ? {
            ...m,
            sets: [],
            partial: {
              home: 14,
              away: 11,
              updatedAt: "2027-06-14T08:28:00.000Z",
            },
          }
        : m,
    ),
    groups: [girone],
  }),
};

/** All my matches played. */
export const garaFinita: HomeGara = {
  ...gara,
  sync: sync({
    matches: partite.map((m) => ({
      ...m,
      state: "conclusa",
      sets: [[21, 18]],
    })),
    groups: [girone],
  }),
};

/** The groups are not drawn yet: no match, no group, no overall row. */
export const garaVuota: HomeGara = {
  ...gara,
  sync: sync({ matches: [], groups: [] }),
  generale: null,
};

const rimini: TappaGiocatore = {
  id: "rimini",
  name: "Tappa 2 · Rimini",
  place: "Rimini, Bagno 26",
  date: "28–29 giugno",
  stato: "iscrizioni_aperte",
  scadenza: "21 giugno, 23:59",
  scadenzaIso: "2027-06-21T21:59:00Z",
  posti: { liberi: 5, totali: 16 },
  fase: null,
  iscrivibile: true,
};

export const prossimaAperta: HomeProssima = {
  tipo: "prossima",
  tappa: rimini,
  iscrizione: null,
};

export const prossimaIscritto: HomeProssima = {
  tipo: "prossima",
  tappa: rimini,
  iscrizione: { tappaId: "rimini", stato: "confermata", posto: 7 },
};

export const prossimaInAttesa: HomeProssima = {
  tipo: "prossima",
  tappa: rimini,
  iscrizione: { tappaId: "rimini", stato: "in_attesa", posto: 12 },
};

export const prossimaEsaurita: HomeProssima = {
  tipo: "prossima",
  tappa: { ...rimini, posti: { liberi: 0, totali: 16 }, iscrivibile: false },
  iscrizione: null,
};

export const prossimaChiusa: HomeProssima = {
  tipo: "prossima",
  tappa: {
    ...rimini,
    id: "cagliari",
    name: "Tappa 3 · Cagliari",
    place: "Cagliari, Poetto",
    date: "12–13 luglio",
    stato: "iscrizioni_chiuse",
    iscrivibile: false,
  },
  iscrizione: null,
};

export const home = (
  vista: Extract<Home, { status: "ok" }>["vista"],
): Home => ({
  status: "ok",
  nome: "Luca",
  vista,
});
