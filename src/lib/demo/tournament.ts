/**
 * Static demo data for the placeholder screens (home, tappe, live,
 * classifica, admin) until the real data layer lands.
 */

export type DemoStage = {
  id: string;
  name: string;
  place: string;
  date: string;
  status: "Iscrizioni aperte" | "Iscrizioni chiuse" | "In corso";
};

export const demoStages: readonly DemoStage[] = [
  {
    id: "jesolo",
    name: "Tappa 1 · Jesolo",
    place: "Jesolo Lido, Piazza Mazzini",
    date: "14–15 giugno",
    status: "In corso",
  },
  {
    id: "rimini",
    name: "Tappa 2 · Rimini",
    place: "Rimini, Bagno 26",
    date: "28–29 giugno",
    status: "Iscrizioni aperte",
  },
  {
    id: "cagliari",
    name: "Tappa 3 · Cagliari",
    place: "Cagliari, Poetto",
    date: "12–13 luglio",
    status: "Iscrizioni chiuse",
  },
];

export type DemoStanding = {
  position: number;
  pair: string;
  stages: number;
  points: number;
};

export const demoStandings: readonly DemoStanding[] = [
  { position: 1, pair: "Rossi / Bianchi", stages: 3, points: 420 },
  { position: 2, pair: "Esposito / Romano", stages: 3, points: 385 },
  { position: 3, pair: "Colombo / Ricci", stages: 2, points: 310 },
  { position: 4, pair: "Marino / Greco", stages: 3, points: 295 },
  {
    position: 5,
    pair: "Bruno-Gallo de Santis / Conti Mancini Lombardi",
    stages: 2,
    points: 240,
  },
];

export type DemoGroupMatch = {
  id: string;
  court: string;
  groupId: string;
  home: string;
  away: string;
  sets: readonly (readonly [number, number])[];
};

export type DemoGroup = {
  id: string;
  label: string;
  rows: readonly {
    position: number;
    pair: string;
    played: number;
    won: number;
    points: number;
  }[];
};

/** Pool-phase groups of the stage in progress (Tappa 1 · Jesolo). */
export const demoGroups: readonly DemoGroup[] = [
  {
    id: "a",
    label: "Girone A",
    rows: [
      { position: 1, pair: "Rossi / Bianchi", played: 2, won: 2, points: 6 },
      { position: 2, pair: "Marino / Greco", played: 2, won: 1, points: 3 },
      { position: 3, pair: "Ferrari / Costa", played: 2, won: 0, points: 0 },
    ],
  },
  {
    id: "b",
    label: "Girone B",
    rows: [
      { position: 1, pair: "Esposito / Romano", played: 2, won: 2, points: 6 },
      { position: 2, pair: "Colombo / Ricci", played: 2, won: 1, points: 3 },
      { position: 3, pair: "Fontana / Moretti", played: 2, won: 0, points: 0 },
    ],
  },
];

/** Matches being played right now, with their sets so far. */
export const demoLiveMatches: readonly DemoGroupMatch[] = [
  {
    id: "m1",
    court: "Campo 1",
    groupId: "a",
    home: "Rossi / Bianchi",
    away: "Marino / Greco",
    sets: [
      [21, 18],
      [12, 9],
    ],
  },
  {
    id: "m2",
    court: "Campo 2",
    groupId: "b",
    home: "Esposito / Romano",
    away: "Colombo / Ricci",
    sets: [
      [17, 21],
      [4, 2],
    ],
  },
];

export type DemoRegistration = {
  id: string;
  pair: string;
  stage: string;
  received: string;
};

export const demoRegistrations: readonly DemoRegistration[] = [
  {
    id: "r1",
    pair: "Ferrari / Costa",
    stage: "Tappa 2 · Rimini",
    received: "12 giugno",
  },
  {
    id: "r2",
    pair: "Fontana / Moretti",
    stage: "Tappa 2 · Rimini",
    received: "11 giugno",
  },
  {
    id: "r3",
    pair: "Barbieri / Rinaldi",
    stage: "Tappa 3 · Cagliari",
    received: "10 giugno",
  },
];
