import type { FaseGirone } from "@/lib/db/types";
import {
  REGOLA_FINALI,
  REGOLA_QUALIFICAZIONE,
  type RegolaFinali,
  type RegolaQualificazione,
} from "@/lib/gironi/fasi/regole";
import type { RigaTabellone, TaglioGirone } from "./types";

/**
 * The qualifying line of a group (BLVS-39 rules, Q-01):
 * - initial group: the gold places are above, the rest go to silver;
 * - gold/silver group: the top 4/n of each of the n groups of its colour
 *   reach that colour's final (none when n doesn't divide 4);
 * - finals: no line.
 */
export function taglioGirone(
  fase: FaseGirone,
  gironiDelColore: number,
  qualificazione: RegolaQualificazione = REGOLA_QUALIFICAZIONE,
  finali: RegolaFinali = REGOLA_FINALI,
): TaglioGirone | null {
  if (fase === "iniziale") {
    if (qualificazione.gold.length === 0) return null;
    return {
      dopo: Math.max(...qualificazione.gold),
      sopra: "gironi gold",
      sotto: "gironi silver",
    };
  }
  if (fase === "gold" || fase === "silver") {
    if (gironiDelColore <= 0 || finali.giocatori % gironiDelColore !== 0) {
      return null;
    }
    return {
      dopo: finali.giocatori / gironiDelColore,
      sopra: `finale ${fase}`,
      sotto: "fuori dalle finali",
    };
  }
  return null;
}

/** Which side of the line a row is on; null before any result. */
export function latoDelTaglio(
  riga: Pick<RigaTabellone, "position">,
  taglio: TaglioGirone | null,
): "sopra" | "sotto" | null {
  if (!taglio || riga.position === null) return null;
  return riga.position <= taglio.dopo ? "sopra" : "sotto";
}

/** Whether the line is drawn right under this row (last row above it). */
export function ultimaSopra(
  rows: readonly Pick<RigaTabellone, "position">[],
  index: number,
  taglio: TaglioGirone | null,
): boolean {
  if (!taglio) return false;
  const qui = latoDelTaglio(rows[index], taglio);
  const dopo = rows[index + 1] ? latoDelTaglio(rows[index + 1], taglio) : null;
  return qui === "sopra" && dopo === "sotto";
}
