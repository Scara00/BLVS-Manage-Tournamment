import type { OverallPlayerRow, OverallStandings } from "@/lib/live/types";
import { GIOCATORE_ANONIMO } from "./anonimo";

/** The player's public row before and after the deletion. */
export type AnteprimaCancellazione = {
  prima: OverallPlayerRow;
  dopo: OverallPlayerRow;
};

/**
 * The row the player has in an overall standing, and the same row once the
 * account is deleted: only the name changes («Giocatore anonimo»); place,
 * points, stages, provisional and tie stay as they are (R-80). Null when
 * the player is not in that standing.
 */
export function anteprimaCancellazione(
  classifica: OverallStandings,
  utenteId: string,
): AnteprimaCancellazione | null {
  const prima = classifica.rows.find((r) => r.playerId === utenteId);
  if (!prima) return null;
  return { prima, dopo: { ...prima, name: GIOCATORE_ANONIMO } };
}
