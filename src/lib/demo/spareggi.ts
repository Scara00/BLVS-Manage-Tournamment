import type { DecisioneSpareggio } from "@/lib/gironi/classifica";

/**
 * The admin's tie decisions of the demo groups (what `spareggi_girone`
 * holds), when Supabase is not configured (CI, e2e). One server instance,
 * reset on restart, like the other demo stores. `classificaDemo` applies
 * them; a decision counts only while its `firma` matches, as in the DB.
 */
type Store = Map<string, DecisioneSpareggio[]>;

const STORE_KEY = Symbol.for("blvs.demo.spareggi");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

export function getDemoDecisioni(gironeId: string): DecisioneSpareggio[] {
  return (store().get(gironeId) ?? []).map((d) => ({
    firma: d.firma,
    ordine: [...d.ordine],
  }));
}

/** Saves (or replaces) the decision for one tie of a demo group. */
export function salvaDemoDecisione(
  gironeId: string,
  decisione: DecisioneSpareggio,
): void {
  const altre = (store().get(gironeId) ?? []).filter(
    (d) => d.firma !== decisione.firma,
  );
  store().set(gironeId, [
    ...altre,
    { firma: decisione.firma, ordine: [...decisione.ordine] },
  ]);
}
