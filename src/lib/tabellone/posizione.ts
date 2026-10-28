import type { Categoria } from "@/lib/db/types";
import { CATEGORIA_NOME } from "@/lib/tappe/avvio/paths";
import { LIVELLO_DELLA_FASE, ORDINE_LIVELLI } from "./fasi";
import { latoDelTaglio } from "./taglio";
import type {
  BoardTabellone,
  GironeTabellone,
  RigaTabellone,
  StageBoard,
} from "./types";

/** Registration id of the player looking at the page; null = spectator. */
export type MeTabellone = string | null;

export type MiaPosizione =
  /** Registered, but in no group yet (groups not drawn). */
  | { stato: "senza_girone" }
  | {
      stato: "in_girone";
      categoria: Categoria;
      girone: GironeTabellone;
      riga: RigaTabellone;
      /** «2°», «2° a pari merito», or «–» before any result. */
      posizione: string;
      lato: "sopra" | "sotto" | null;
      /** «Per ora sopra la linea: gironi gold», or null without a line. */
      taglio: string | null;
    };

/** «2», «2=» (open tie) or «–»: the place as the table shows it. */
export function posizioneBreve(riga: Pick<RigaTabellone, "position" | "pari">) {
  if (riga.position === null) return "–";
  return riga.pari ? `${riga.position}=` : String(riga.position);
}

/** «2°», «2° a pari merito» or «–»: the place in words. */
export function posizioneEstesa(
  riga: Pick<RigaTabellone, "position" | "pari">,
) {
  if (riga.position === null) return "–";
  return riga.pari ? `${riga.position}° a pari merito` : `${riga.position}°`;
}

/** The text of a row's side of the line, worded for the player. */
export function testoTaglio(
  girone: Pick<GironeTabellone, "taglio" | "stato">,
  riga: Pick<RigaTabellone, "position">,
): string | null {
  const lato = latoDelTaglio(riga, girone.taglio);
  if (!lato || !girone.taglio) return null;
  const meta = lato === "sopra" ? girone.taglio.sopra : girone.taglio.sotto;
  const prefisso = girone.stato === "completo" ? "" : "Per ora ";
  const testo = `${prefisso}${lato} la linea: ${meta}`;
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/**
 * The player's place (R-07): their group at the most advanced level
 * (a player keeps their initial group when they move on, BLVS-39), their
 * row and their side of the line. Null for a spectator.
 */
export function miaPosizione(
  stage: Pick<StageBoard, "boards">,
  me: MeTabellone,
): MiaPosizione | null {
  if (!me) return null;
  let migliore: { board: BoardTabellone; girone: GironeTabellone } | null =
    null;
  for (const board of stage.boards) {
    for (const girone of board.gironi) {
      if (!girone.rows.some((r) => r.playerId === me)) continue;
      if (
        !migliore ||
        ORDINE_LIVELLI.indexOf(girone.livello) >
          ORDINE_LIVELLI.indexOf(migliore.girone.livello)
      ) {
        migliore = { board, girone };
      }
    }
  }
  if (!migliore) return { stato: "senza_girone" };
  const { board, girone } = migliore;
  const riga = girone.rows.find((r) => r.playerId === me)!;
  return {
    stato: "in_girone",
    categoria: board.categoria,
    girone,
    riga,
    posizione: posizioneEstesa(riga),
    lato: latoDelTaglio(riga, girone.taglio),
    taglio: testoTaglio(girone, riga),
  };
}

/**
 * The groups of a board split for the page: the level in play first, the
 * levels already played after it (collapsed). Levels after the current
 * one (a gold/silver proposal not started yet) are not shown.
 */
export function gironiPerLivello(board: BoardTabellone): {
  correnti: GironeTabellone[];
  precedenti: GironeTabellone[];
} {
  const livello = LIVELLO_DELLA_FASE[board.fase];
  const indice = ORDINE_LIVELLI.indexOf(livello);
  return {
    correnti: board.gironi.filter((g) => g.livello === livello),
    // The most recent level first, groups in their own order.
    precedenti: board.gironi
      .filter((g) => ORDINE_LIVELLI.indexOf(g.livello) < indice)
      .sort(
        (a, b) =>
          ORDINE_LIVELLI.indexOf(b.livello) - ORDINE_LIVELLI.indexOf(a.livello),
      ),
  };
}

/** «Tabellone maschile». */
export function titoloBoard(categoria: Categoria): string {
  return `Tabellone ${CATEGORIA_NOME[categoria]}`;
}
