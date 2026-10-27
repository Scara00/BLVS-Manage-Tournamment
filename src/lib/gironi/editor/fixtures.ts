import type { FaseTabellone } from "@/lib/db/types";
import type { ComposizioneGironi, GiocatoreGirone } from "./types";

/** Names for demo boards, stories and tests (no real people). */
export const NOMI_DEMO = [
  "Giulia Bianchi",
  "Marco Rossi",
  "Sara Colombo",
  "Luca Ferrari",
  "Chiara Esposito",
  "Matteo Romano",
  "Francesca Ricci",
  "Alessandro Marino",
  "Elena Greco",
  "Davide Bruno",
  "Martina Gallo",
  "Simone Conti",
  "Anna De Luca",
  "Federico Mancini",
  "Valentina Costa",
  "Andrea Giordano",
  "Beatrice Rizzo",
  "Lorenzo Lombardi",
  "Alessia Moretti",
  "Riccardo Barbieri",
  "Maria Vittoria Fontana Santangelo",
  "Gabriele Fumagalli",
  "Ilaria Caruso",
  "Tommaso Ferrara",
] as const;

export function giocatoriDemo(n: number, prefisso = "i"): GiocatoreGirone[] {
  return Array.from({ length: n }, (_, i) => ({
    iscrizioneId: `${prefisso}${i + 1}`,
    nome: NOMI_DEMO[i % NOMI_DEMO.length],
  }));
}

/**
 * `n` players split in order into groups of 4 («Girone A», «B»…); the
 * players beyond `gironi * 4` stay unassigned.
 */
export function composizioneDemo({
  giocatori: n = 16,
  gironi = Math.floor(n / 4),
  fase = "gold" as FaseTabellone | null,
  tabelloneId = "tab-1",
  versione = 0,
  bloccata = false,
} = {}): ComposizioneGironi {
  const tutti = giocatoriDemo(n);
  return {
    tabelloneId,
    fase,
    versione,
    bloccata,
    gironi: Array.from({ length: gironi }, (_, i) => ({
      id: `g${i + 1}`,
      nome: `Girone ${String.fromCharCode(65 + i)}`,
      posizione: i + 1,
      fase,
      giocatori: tutti.slice(i * 4, i * 4 + 4),
    })),
    nonAssegnati: tutti.slice(gironi * 4),
  };
}
