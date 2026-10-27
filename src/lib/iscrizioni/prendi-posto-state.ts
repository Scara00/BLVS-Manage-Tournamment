/** State of the «Prendi il posto» form (plain module: client components import it). */
export type PrendiPostoState =
  { status: "idle" } | { status: "error"; message: string; attempt: number };

export const PRENDI_POSTO_INITIAL: PrendiPostoState = { status: "idle" };
