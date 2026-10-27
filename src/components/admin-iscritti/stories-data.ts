import type { StatoTappa } from "@/lib/db/types";
import { toIscrittiTappaView } from "@/lib/iscrizioni/admin/format";
import type {
  GiocatoreTrovato,
  IscrittiTappaView,
  IscrittoRow,
} from "@/lib/iscrizioni/admin/types";

/** Fixtures shared by the stories and the tests of w-admin-iscritti. */
const NOMI_M = [
  ["Luca", "Rossi"],
  ["Marco", "Bianchi"],
  ["Andrea", "Ferrari"],
  ["Matteo", "Esposito"],
  ["Davide", "Romano"],
  ["Simone", "Colombo"],
  ["Federico", "Ricci"],
  ["Nicolò", "D'Amico"],
] as const;

const NOMI_F = [
  ["Giulia", "Marino"],
  ["Chiara", "Greco"],
  ["Francesca", "Bruno"],
  ["Sara", "Gallo"],
  ["Martina", "Conti"],
  ["Elena", "Mancini"],
  ["Alessia", "Costa"],
  ["Valentina", "Giordano"],
] as const;

function righe(
  nomi: readonly (readonly [string, string])[],
  categoria: "M" | "F",
  quanti: number,
): IscrittoRow[] {
  return nomi.slice(0, quanti).map(([nome, cognome], i) => ({
    id: `${categoria}-${i + 1}`,
    posto: i + 1,
    stato: i % 4 === 3 ? "in_attesa" : "confermata",
    created_at: new Date(
      Date.UTC(2027, 4, 15, 7 + i, (i * 17) % 60),
    ).toISOString(),
    categoria,
    nome,
    cognome,
    email: `${nome.toLowerCase()}.${cognome.toLowerCase().replace(/\W/g, "")}@example.it`,
  }));
}

export function iscrittiDemo({
  stato = "iscrizioni_chiuse",
  posti = 8,
  m = 6,
  f = 3,
}: {
  stato?: StatoTappa;
  posti?: number;
  m?: number;
  f?: number;
} = {}): IscrittiTappaView {
  return toIscrittiTappaView(
    {
      id: "rimini",
      nome: "Tappa 2 · Rimini",
      data_inizio: "2027-06-26",
      data_fine: "2027-06-27",
      stato,
    },
    [
      { categoria: "M", posti },
      { categoria: "F", posti },
    ],
    [...righe(NOMI_M, "M", m), ...righe(NOMI_F, "F", f)],
  );
}

export const giocatoriTrovati: GiocatoreTrovato[] = [
  {
    id: "g1",
    nome: "Lorenzo",
    cognome: "Rossetti",
    email: "lorenzo.rossetti@example.it",
    categoria: "M",
    iscritto: false,
  },
  {
    id: "g2",
    nome: "Luca",
    cognome: "Rossi",
    email: "luca.rossi@example.it",
    categoria: "M",
    iscritto: true,
  },
  {
    id: "g3",
    nome: "Elena",
    cognome: "Rossini",
    email: "elena.rossini@example.it",
    categoria: "F",
    iscritto: false,
  },
  {
    id: "g4",
    nome: "Niccolò",
    cognome: "Rosso",
    email: "niccolo.rosso@example.it",
    categoria: null,
    iscritto: false,
  },
];
