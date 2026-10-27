export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;

/**
 * Delay before reconnect attempt `attempt` (0-based): exponential from 1 s,
 * capped at 30 s, with "equal jitter" (between half and all of the step) so
 * a venue full of phones doesn't reconnect in lockstep.
 */
export function backoffDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(step / 2 + (step / 2) * random());
}
