import { paritaGirone } from "@/lib/gironi/parita/format";
import type {
  ParitaGirone,
  RisolviParitaAction,
} from "@/lib/gironi/parita/types";

const G = ["Luca Rossi", "Marco Bianchi", "Paolo Marino", "Andrea Greco"];
const id = (i: number) => `demo-M-i${i + 1}`;

/**
 * Girone A, all three matches won 21–19 by Luca Rossi (A+B, A+C, A+D):
 * the other three are level in every criterion for 2nd place.
 */
export function paritaTreDemo(decisione?: {
  ordine: string[];
  motivo: string;
}): ParitaGirone {
  const vince = (turno: number, compagno: number, altri: [number, number]) => ({
    id: `demo-M-g1-t${turno}`,
    stato: "conclusa" as const,
    squadre: { A: [id(0), id(compagno)], B: altri.map(id) },
    sets: [{ a: 21, b: 19 }],
  });
  const partite = [
    vince(1, 1, [2, 3]),
    vince(2, 2, [1, 3]),
    vince(3, 3, [1, 2]),
  ];
  const firma = paritaGirone({
    tappaId: "jesolo",
    categoria: "M",
    gironeId: "demo-M-g1",
    gironeNome: "Girone A",
    giocatori: G.map((nome, i) => ({ iscrizioneId: id(i), nome })),
    partite,
    decisioni: [],
  }).parita[0].firma;
  return paritaGirone({
    tappaId: "jesolo",
    categoria: "M",
    gironeId: "demo-M-g1",
    gironeNome: "Girone A",
    giocatori: G.map((nome, i) => ({ iscrizioneId: id(i), nome })),
    partite,
    decisioni: decisione ? [{ firma, ...decisione }] : [],
  });
}

/** Two players level for 1st place: A+B and C+D split two matches. */
export function paritaDueDemo(): ParitaGirone {
  const giocatori = [
    { iscrizioneId: "f-1", nome: "Giulia Conti" },
    { iscrizioneId: "f-2", nome: "Sara Marino" },
  ];
  return paritaGirone({
    tappaId: "jesolo",
    categoria: "F",
    gironeId: "demo-F-g2",
    gironeNome: "Girone B",
    giocatori,
    partite: [
      {
        id: "f-t1",
        stato: "conclusa",
        squadre: { A: ["f-1"], B: ["f-2"] },
        sets: [{ a: 21, b: 18 }],
      },
      {
        id: "f-t2",
        stato: "conclusa",
        squadre: { A: ["f-2"], B: ["f-1"] },
        sets: [{ a: 21, b: 18 }],
      },
    ],
    decisioni: [],
  });
}

export const risolviDemo: RisolviParitaAction = async (prev) => ({
  status: "success",
  message:
    "Girone A: ordine deciso. 2º Marco Bianchi, 3º Paolo Marino, 4º Andrea Greco.",
  firma: "",
  at: prev.status === "idle" ? 1 : prev.at + 1,
});

/** Never answers: the request stays in flight. */
export const risolviInAttesa: RisolviParitaAction = () => new Promise(() => {});
