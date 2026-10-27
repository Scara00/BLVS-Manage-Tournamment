import type {
  PunteggioPerso,
  RigenerazioneTabellone,
} from "@/lib/gironi/rigenera/types";

/** Lost scores for stories and tests (no real people). */
export const punteggiPersiDemo: PunteggioPerso[] = [
  {
    partitaId: "p1",
    girone: "Girone A",
    turno: 1,
    stato: "conclusa",
    sets: [
      { a: 21, b: 18 },
      { a: 19, b: 21 },
      { a: 15, b: 12 },
    ],
    squadraA: ["Giulia Bianchi", "Marco Rossi"],
    squadraB: ["Sara Colombo", "Luca Ferrari"],
  },
  {
    partitaId: "p2",
    girone: "Girone A",
    turno: 2,
    stato: "in_corso",
    sets: [{ a: 21, b: 15 }],
    squadraA: ["Giulia Bianchi", "Sara Colombo"],
    squadraB: ["Marco Rossi", "Luca Ferrari"],
  },
  {
    partitaId: "p3",
    girone: "Girone B",
    turno: 1,
    stato: "conclusa",
    sets: [
      { a: 21, b: 19 },
      { a: 21, b: 17 },
    ],
    squadraA: ["Maria Vittoria Fontana Santangelo", "Matteo Romano"],
    squadraB: ["Francesca Ricci", "Alessandro Marino"],
  },
];

export function rigenerazioneDemo(
  punteggi: PunteggioPerso[] = punteggiPersiDemo,
): RigenerazioneTabellone {
  return { tappaId: "jesolo", categoria: "M", punteggi };
}
