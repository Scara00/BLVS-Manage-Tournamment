import type { FaseGirone } from "@/lib/db/types";
import { classificaGirone } from "@/lib/gironi/classifica";
import type { GironeClassificato } from "@/lib/gironi/fasi/qualificazione";
import type {
  ProssimaFaseAction,
  ProssimaFaseView,
} from "@/lib/gironi/fasi/types";
import { vistaProssimaFase } from "@/lib/gironi/fasi/vista";

const NOMI = [
  "Luca Rossi",
  "Marco Bianchi",
  "Paolo Marino",
  "Andrea Greco",
  "Matteo Ferrari",
  "Davide Costa",
  "Simone Esposito",
  "Luca Romano",
  "Marco Colombo",
  "Paolo Ricci",
  "Andrea Fontana",
  "Matteo Moretti",
  "Davide Conti",
  "Simone Gallo",
  "Luca Bruno",
  "Marco Mancini",
];

const ROTAZIONE = [
  [
    ["A", "B"],
    ["C", "D"],
  ],
  [
    ["A", "C"],
    ["B", "D"],
  ],
  [
    ["A", "D"],
    ["B", "C"],
  ],
] as const;

/**
 * A group of 4 with all 3 matches played: A wins them all; by default by
 * margins that leave no tie, with `pari` 21-19 so B, C and D are level.
 */
function girone(
  k: number,
  nome: string,
  fase: FaseGirone,
  { pari = false, nomi = NOMI } = {},
): GironeClassificato {
  const id = (l: string) => `${fase}-${k}-${l}`;
  const iscrizioni = ["A", "B", "C", "D"].map(id);
  const sets = pari
    ? [19, 19, 19].map((b) => ({ a: 21, b }))
    : [10, 12, 14].map((b) => ({ a: 21, b }));
  return {
    id: `girone-${fase}-${k}`,
    nome,
    fase,
    nomi: Object.fromEntries(
      iscrizioni.map((i, n) => [i, nomi[(k * 4 + n) % nomi.length]]),
    ),
    classifica: classificaGirone(
      iscrizioni,
      ROTAZIONE.map(([a, b], t) => ({
        id: `${nome}-t${t + 1}`,
        stato: "conclusa" as const,
        squadre: { A: a.map(id), B: b.map(id) },
        sets: [sets[t]],
      })),
    ),
  };
}

const LETTERE = ["A", "B", "C", "D"];
const tappa = { id: "jesolo", nome: "Tappa 1 · Jesolo" };

const iniziali = (opzioni: { pari?: boolean; nomi?: string[] } = {}) =>
  LETTERE.map((l, k) =>
    girone(
      k,
      `Girone ${l}`,
      "iniziale",
      k === 0 ? opzioni : { nomi: opzioni.nomi },
    ),
  );

const goldSilver = (opzioni: { nomi?: string[] } = {}) => [
  girone(0, "Gold A", "gold", opzioni),
  girone(1, "Gold B", "gold", opzioni),
  girone(2, "Silver A", "silver", opzioni),
  girone(3, "Silver B", "silver", opzioni),
];

function vista(
  tipo: "gold_silver" | "finali",
  gironi: GironeClassificato[],
  extra: { proposta?: boolean; finali?: boolean } = {},
): ProssimaFaseView {
  return vistaProssimaFase(tipo, {
    tappa,
    categoria: "M",
    faseGioco:
      tipo === "gold_silver"
        ? "gironi_iniziali"
        : extra.finali
          ? "finali"
          : "gironi_gold_silver",
    proposta: extra.proposta ?? false,
    gironi,
  })!;
}

/** Initial groups concluded: the gold/silver proposal is ready. */
export const propostaPronta = vista("gold_silver", iniziali());
/** A perfect tie in Girone A blocks the proposal. */
export const propostaParita = vista("gold_silver", iniziali({ pari: true }));
/** Three initial groups: a gold and a silver group of 2 to complete. */
export const propostaIncompleta = vista("gold_silver", iniziali().slice(0, 3));
/** The proposal is saved: it is checked in the editor below. */
export const propostaSalvata = vista("gold_silver", iniziali(), {
  proposta: true,
});
/** Gold and silver concluded: the finals are ready. */
export const finaliPronte = vista("finali", goldSilver());
/** The finals exist. */
export const finaliGenerate = vista("finali", goldSilver(), { finali: true });

const LUNGHI = NOMI.map((n) => `${n} Della Valle Bartolomei-Santangelo`);
export const propostaNomiLunghi = vista(
  "gold_silver",
  iniziali({ nomi: LUNGHI }),
);

/** A server action that never answers: the story stays as it is. */
export const azioneFinta: ProssimaFaseAction = () => new Promise(() => {});
