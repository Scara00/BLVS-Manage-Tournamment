import type { OverallPlayerRow, OverallStandings } from "@/lib/live/types";

/** The player's public row, which the deletion removes. */
export type AnteprimaCancellazione = {
  attuale: OverallPlayerRow;
};

/**
 * The row the player has in an overall standing. Deleting the account
 * removes it with every result of the player, and the standing is computed
 * again without them. Null when the player is not in that standing.
 */
export function anteprimaCancellazione(
  classifica: OverallStandings,
  utenteId: string,
): AnteprimaCancellazione | null {
  const attuale = classifica.rows.find((r) => r.playerId === utenteId);
  return attuale ? { attuale } : null;
}
