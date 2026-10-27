import type { ImpattoFase } from "@/lib/punteggi/correzione/types";
import type { RitiroAction, RitiroState } from "@/lib/ritiri/types";
import type {
  GiocatorePartita,
  PartitaLive,
} from "@/lib/tappe/live-admin/types";

/** Demo data for the w-admin-ritiro stories and component tests. */

function giocatore(cognome: string): GiocatorePartita {
  return { iscrizioneId: `i-${cognome}`, nome: "Luca", cognome };
}

const [ROSSI, BIANCHI, MARINO, GRECO] = [
  "Rossi",
  "Bianchi",
  "Marino",
  "Greco",
].map(giocatore);

function partita(
  turno: number,
  squadraA: GiocatorePartita[],
  squadraB: GiocatorePartita[],
  extra: Partial<PartitaLive> = {},
): PartitaLive {
  return {
    id: `g1-t${turno}`,
    fase: "gironi",
    gironeId: "g1",
    gironeNome: "Girone A",
    gironeFase: "iniziale",
    gironePosizione: 1,
    turno,
    campo: "Campo 1",
    programmataIl: null,
    stato: "programmata",
    squadraA,
    squadraB,
    sets: [],
    versione: 1,
    ...extra,
  };
}

/** Girone A: round 1 played (Rossi and Bianchi won 21–18), 2 and 3 to play. */
export const partiteGirone: PartitaLive[] = [
  partita(1, [ROSSI, BIANCHI], [MARINO, GRECO], {
    stato: "conclusa",
    sets: [{ a: 21, b: 18 }],
    versione: 2,
  }),
  partita(2, [ROSSI, MARINO], [BIANCHI, GRECO]),
  partita(3, [ROSSI, GRECO], [BIANCHI, MARINO]),
];

export const girone = { id: "g1", nome: "Girone A" };

export const impattoFase: ImpattoFase = {
  partite: [
    {
      id: "gold-a-t1",
      fase: "gironi",
      girone: "Gold A",
      turno: 1,
      stato: "conclusa",
      sets: [{ a: 21, b: 16 }],
      squadre: {
        a: ["Luca Rossi", "Luca Bianchi"],
        b: ["Anna Neri", "Sara Blu"],
      },
    },
    {
      id: "gold-a-t2",
      fase: "gironi",
      girone: "Gold A",
      turno: 2,
      stato: "programmata",
      sets: [],
      squadre: {
        a: ["Luca Rossi", "Anna Neri"],
        b: ["Luca Bianchi", "Sara Blu"],
      },
    },
  ],
  punteggiPersi: 1,
};

/** Answers success at once (Storybook). */
export const azioneOk: RitiroAction = async (prev) => ({
  status: "success",
  message: "Ritiro registrato per Rossi Luca: 2 partite annullate.",
  scelta: null,
  punteggiPersi: 0,
  at: prev.status === "idle" ? 1 : prev.at + 1,
});

/** Never answers: the loading state (Storybook). */
export const azioneInAttesa: RitiroAction = () =>
  new Promise<RitiroState>(() => {});
