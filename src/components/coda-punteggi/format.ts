import type { SetPunteggio } from "@/lib/db/types";
import { formatServerTime } from "@/lib/time/server-time";

/** «21–18 · 19–21»; «nessun set» for an empty score. */
export function descriviSets(sets: readonly SetPunteggio[]): string {
  return sets.length
    ? sets.map((s) => `${s.a}–${s.b}`).join(" · ")
    : "nessun set";
}

export function oraBreve(iso: string): string {
  return formatServerTime(new Date(iso), { timeStyle: "short" });
}
