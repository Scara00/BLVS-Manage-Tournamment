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

/**
 * The player stage list (w-tappe) in the shape of `public.tappe` and RPC
 * `posti_tappe()`. It includes a draft (never shown to players) and a
 * cancelled stage, so the demo exercises every rule of the list.
 */
export const demoTappeGiocatore = {
  /** The demo player's category. */
  categoria: "M" as const,
  tappe: [
    {
      id: "jesolo",
      nome: "Tappa 1 · Jesolo",
      luogo: "Jesolo Lido, Piazza Mazzini",
      data_inizio: "2026-06-14",
      data_fine: "2026-06-15",
      stato: "in_corso" as const,
      iscrizioni_chiudono_il: "2026-06-07T21:59:00Z",
    },
    {
      id: "rimini",
      nome: "Tappa 2 · Rimini",
      luogo: "Rimini, Bagno 26",
      data_inizio: "2026-06-28",
      data_fine: "2026-06-29",
      stato: "iscrizioni_aperte" as const,
      iscrizioni_chiudono_il: "2026-06-21T21:59:00Z",
    },
    {
      id: "cagliari",
      nome: "Tappa 3 · Cagliari",
      luogo: "Cagliari, Poetto",
      data_inizio: "2026-07-12",
      data_fine: "2026-07-13",
      stato: "iscrizioni_chiuse" as const,
      iscrizioni_chiudono_il: "2026-07-05T21:59:00Z",
    },
    {
      id: "pescara",
      nome: "Tappa 4 · Pescara",
      luogo: "Pescara, Lungomare Matteotti",
      data_inizio: "2026-07-26",
      data_fine: "2026-07-27",
      stato: "annullata" as const,
      iscrizioni_chiudono_il: "2026-07-19T21:59:00Z",
    },
    {
      id: "lignano",
      nome: "Tappa 5 · Lignano (bozza)",
      luogo: "Lignano Sabbiadoro",
      data_inizio: "2026-08-09",
      data_fine: "2026-08-10",
      stato: "bozza" as const,
      iscrizioni_chiudono_il: null,
    },
  ],
  posti: [
    {
      tappa_id: "jesolo",
      categoria: "M" as const,
      posti: 16,
      occupati: 16,
      fase: "gironi" as const,
    },
    {
      tappa_id: "jesolo",
      categoria: "F" as const,
      posti: 16,
      occupati: 12,
      fase: "gironi" as const,
    },
    {
      tappa_id: "rimini",
      categoria: "M" as const,
      posti: 16,
      occupati: 11,
      fase: null,
    },
    {
      tappa_id: "rimini",
      categoria: "F" as const,
      posti: 12,
      occupati: 12,
      fase: null,
    },
    {
      tappa_id: "cagliari",
      categoria: "M" as const,
      posti: 32,
      occupati: 24,
      fase: null,
    },
    {
      tappa_id: "cagliari",
      categoria: "F" as const,
      posti: 16,
      occupati: 9,
      fase: null,
    },
    {
      tappa_id: "pescara",
      categoria: "M" as const,
      posti: 16,
      occupati: 3,
      fase: null,
    },
    {
      tappa_id: "pescara",
      categoria: "F" as const,
      posti: 16,
      occupati: 2,
      fase: null,
    },
  ],
};
