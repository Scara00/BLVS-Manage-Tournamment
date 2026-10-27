import type { LiveSync } from "@/lib/live/types";
import type { AzionePartitaAction } from "@/lib/tappe/live-admin/state";
import type {
  GiocatorePartita,
  PartitaLive,
  TabelloneLive,
} from "@/lib/tappe/live-admin/types";

/** Demo data for the w-admin-live stories and component tests. */

const COGNOMI = [
  ["Rossi", "Bianchi", "Marino", "Greco"],
  ["Ferrari", "Costa", "Esposito", "Romano"],
  ["Colombo", "Ricci", "Fontana", "Moretti"],
];

function giocatore(cognome: string): GiocatorePartita {
  return { iscrizioneId: `i-${cognome}`, nome: "Luca", cognome };
}

const ROTAZIONE = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

function partite(): PartitaLive[] {
  return COGNOMI.flatMap((cognomi, g) =>
    ROTAZIONE.map(([a1, a2, b1, b2], t): PartitaLive => ({
      id: `g${g + 1}-t${t + 1}`,
      fase: "gironi",
      gironeId: `g${g + 1}`,
      gironeNome: `Girone ${String.fromCharCode(65 + g)}`,
      gironePosizione: g + 1,
      turno: t + 1,
      campo: `Campo ${g + 1}`,
      programmataIl: null,
      stato: "programmata",
      squadraA: [giocatore(cognomi[a1]), giocatore(cognomi[a2])],
      squadraB: [giocatore(cognomi[b1]), giocatore(cognomi[b2])],
      sets: [],
      versione: 1,
    })),
  );
}

function conStati(
  modifiche: Record<string, Partial<PartitaLive>>,
): PartitaLive[] {
  return partite().map((p) => ({ ...p, ...modifiche[p.id] }));
}

const base = {
  tappa: { id: "jesolo", nome: "Tappa 1 · Jesolo", stato: "in_corso" },
  categoria: "M",
  faseGioco: "gironi_iniziali",
  lettoIl: "2026-06-14T09:30:00.000Z",
} as const satisfies Omit<TabelloneLive, "partite">;

/** Mid-race: one concluded, two in progress (one with a partial score). */
export const inGara: TabelloneLive = {
  ...base,
  partite: conStati({
    "g1-t1": {
      stato: "conclusa",
      sets: [
        { a: 21, b: 18 },
        { a: 21, b: 15 },
      ],
      versione: 2,
    },
    "g1-t2": { stato: "in_corso" },
    "g2-t1": { stato: "in_corso", sets: [{ a: 21, b: 19 }], versione: 2 },
  }),
};

/** Just started: every match «da giocare». */
export const appenaAvviata: TabelloneLive = { ...base, partite: partite() };

/** Phase not started yet: nothing to show. */
export const nonAvviata: TabelloneLive = {
  ...base,
  tappa: { ...base.tappa, stato: "iscrizioni_chiuse" },
  faseGioco: null,
  partite: [],
};

export const liveSync: LiveSync = {
  snapshot: {
    seq: 0,
    updatedAt: "2026-06-14T09:30:00.000Z",
    matches: [],
    groups: [],
    overall: [],
    pendingScores: [],
  },
  syncedAt: "2026-06-14T09:30:00.000Z",
};

/** Stands in for the server actions: answers after a short pause. */
export const azioneFinta: AzionePartitaAction = async (prev) => {
  await new Promise((r) => setTimeout(r, 400));
  return {
    status: "success",
    partitaId: "g1-t3",
    message: "Girone A · turno 3: partita in corso.",
    at: prev.status === "idle" ? 1 : prev.at + 1,
  };
};
