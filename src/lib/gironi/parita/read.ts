import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { getDemoDatiParita } from "@/lib/demo/parita";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { leggiDatiParitaTabellone } from "./dati";
import { paritaGirone } from "./format";
import type { ParitaGirone } from "./types";

/**
 * The perfect ties of every group of one board, for w-admin-gironi and
 * w-admin-live. The pages check the admin role first; without Supabase env
 * it reads the demo matches. A failed read shows no tie rather than
 * breaking the page around it.
 */
export async function readParitaTabellone(
  tappaId: string,
  categoria: Categoria,
): Promise<ParitaGirone[]> {
  if (!readSupabaseEnv()) {
    return (getDemoDatiParita(tappaId, categoria) ?? []).map((g) =>
      paritaGirone(g),
    );
  }
  try {
    const user = await getCurrentUser();
    if (user?.ruolo !== "admin") return [];
    const dati = await leggiDatiParitaTabellone(
      user.supabase,
      tappaId,
      categoria,
    );
    return (dati ?? []).map((g) => paritaGirone(g));
  } catch (error) {
    console.error("[gironi] lettura delle parità non riuscita", error);
    return [];
  }
}
