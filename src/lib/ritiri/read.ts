import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { getDemoAssenze } from "@/lib/demo/ritiri";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { leggiAssenze } from "./dati";
import { noteAssenze } from "./format";
import type { AssenzaRegistrata } from "./types";

/**
 * The absences of one board for w-admin-live, read with the admin's
 * session (the page has checked the role). Without Supabase env: the demo
 * store. A failed read shows none rather than breaking the page.
 */
export async function readAssenzeTabellone(
  tappaId: string,
  categoria: Categoria,
): Promise<AssenzaRegistrata[]> {
  if (!readSupabaseEnv()) return getDemoAssenze(tappaId, categoria);
  try {
    const user = await getCurrentUser();
    if (user?.ruolo !== "admin") return [];
    return await leggiAssenze(user.supabase, tappaId, categoria);
  } catch (error) {
    console.error("[ritiri] lettura delle assenze non riuscita", error);
    return [];
  }
}

/**
 * The standing notes of a board («Ritirato», …) for a live publisher;
 * empty when they cannot be read, so a score is still published.
 */
export async function leggiNoteAssenze(
  supabase: SupabaseClient | null,
  tappaId: string,
  categoria: Categoria,
): Promise<Map<string, string>> {
  try {
    const assenze = supabase
      ? await leggiAssenze(supabase, tappaId, categoria)
      : getDemoAssenze(tappaId, categoria);
    return noteAssenze(assenze);
  } catch (error) {
    console.error("[ritiri] lettura delle assenze non riuscita", error);
    return new Map();
  }
}
