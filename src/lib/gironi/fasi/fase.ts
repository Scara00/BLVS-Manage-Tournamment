import type { FaseGioco, FaseGirone, FaseTabellone } from "@/lib/db/types";

/** The phase of a board, always as text (R-30). */
export const FASE_GIOCO_LABEL: Record<FaseGioco, string> = {
  gironi_iniziali: "Gironi iniziali",
  gironi_gold_silver: "Gironi gold e silver",
  finali: "Finali",
};

export const FASE_GIRONE_LABEL: Record<FaseGirone, string> = {
  iniziale: "Girone iniziale",
  gold: "Gold",
  silver: "Silver",
  finale_gold: "Finale gold",
  finale_silver: "Finale silver",
};

/**
 * The groups of a board are on one level per game phase. Mirror of
 * `public.livello_girone()`.
 */
export type LivelloGironi = "iniziale" | "gold_silver" | "finali";

export function livelloGirone(fase: FaseGirone): LivelloGironi {
  if (fase === "iniziale") return "iniziale";
  return fase === "gold" || fase === "silver" ? "gold_silver" : "finali";
}

/** The game phase that plays the groups of `livello`. */
export const FASE_GIOCO_DEL_LIVELLO: Record<LivelloGironi, FaseGioco> = {
  iniziale: "gironi_iniziali",
  gold_silver: "gironi_gold_silver",
  finali: "finali",
};

/** Gold or silver for the ★/◆ marker; null for the initial groups. */
export function coloreGirone(fase: FaseGirone): FaseTabellone | null {
  if (fase === "gold" || fase === "finale_gold") return "gold";
  if (fase === "silver" || fase === "finale_silver") return "silver";
  return null;
}

/** Whether game phase `a` comes after `b` (null = not started). */
export function faseDopo(a: FaseGioco | null, b: FaseGioco | null): boolean {
  const ordine = (f: FaseGioco | null) =>
    f === null
      ? -1
      : (["gironi_iniziali", "gironi_gold_silver", "finali"] as const).indexOf(
          f,
        );
  return ordine(a) > ordine(b);
}

/**
 * The first free «Girone A…Z», «Gold A…», «Silver A…» name, then «… 27»,
 * «… 28». Same rule as `public.prossimo_nome_girone()`.
 */
export function prossimoNomeGirone(
  gironi: readonly { nome: string }[],
  fase: FaseGirone = "iniziale",
): string {
  const prefisso =
    fase === "gold" ? "Gold" : fase === "silver" ? "Silver" : "Girone";
  const usati = new Set(gironi.map((g) => g.nome));
  for (let i = 0; i < 26; i += 1) {
    const nome = `${prefisso} ${String.fromCharCode(65 + i)}`;
    if (!usati.has(nome)) return nome;
  }
  for (let n = 27; ; n += 1) {
    if (!usati.has(`${prefisso} ${n}`)) return `${prefisso} ${n}`;
  }
}

/**
 * What the live pages announce when a phase starts (R-30): «iniziati i
 * gironi gold e silver, 12 partite da giocare».
 */
export function annuncioFase(fase: FaseGioco, partite: number): string {
  const n = partite === 1 ? "1 partita" : `${partite} partite`;
  switch (fase) {
    case "gironi_iniziali":
      return `iniziati i gironi, ${n} da giocare`;
    case "gironi_gold_silver":
      return `iniziati i gironi gold e silver, ${n} da giocare`;
    case "finali":
      return `generate le finali, ${n} da giocare`;
  }
}

/**
 * The phase of a board as admins read it (BLVS-43): its game phase, or
 * «Conclusa» once it is closed. Derived, never stored: `fase_gioco` stays
 * 'finali' and `tabelloni.concluso_il` is set.
 */
export type FaseDelTabellone = FaseGioco | "conclusa";

export const FASE_TABELLONE_LABEL: Record<FaseDelTabellone, string> = {
  ...FASE_GIOCO_LABEL,
  conclusa: "Conclusa",
};

export function faseDelTabellone(
  faseGioco: FaseGioco | null,
  conclusoIl: string | null,
): FaseDelTabellone | null {
  if (conclusoIl !== null) return "conclusa";
  return faseGioco;
}

/** Spoken when a board is concluded (live channel). */
export function annuncioChiusura(tappaConclusa: boolean): string {
  return tappaConclusa
    ? "tabellone concluso, punti definitivi. La tappa è conclusa"
    : "tabellone concluso, punti definitivi";
}
