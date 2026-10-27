/** w-admin-live: the group matches of a stage, with their scores. */
export function punteggiPath(tappaId: string): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/punteggi`;
}

/** w-admin-punteggio: score entry (or correction) of one match. */
export function punteggioPath(tappaId: string, partitaId: string): string {
  return `${punteggiPath(tappaId)}/${encodeURIComponent(partitaId)}`;
}
