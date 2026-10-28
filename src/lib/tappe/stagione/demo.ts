/**
 * Demo seasons of the gestione demo stages (no Supabase env). Like
 * `tappe.stagione`, a stage without one counts for the year of its day.
 */
import { stagioneDaData } from "@/lib/classifica-generale/stagione";

type Store = Map<string, number>;
const STORE_KEY = Symbol.for("blvs.demo.stagioni-tappe");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

export function getDemoStagione(tappaId: string, dataInizio: string): number {
  return store().get(tappaId) ?? stagioneDaData(dataInizio);
}

export function impostaDemoStagione(tappaId: string, stagione: number) {
  store().set(tappaId, stagione);
}
