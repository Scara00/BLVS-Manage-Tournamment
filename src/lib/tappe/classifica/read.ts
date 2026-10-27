import "server-only";
import type { Categoria } from "@/lib/db/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ClassificaTappa } from "./classifica";
import { leggiClassificaTappa } from "./dati";

/**
 * The stage standing of one category, recomputed on every call, so a
 * corrected score or a withdrawal shows at once. Null when the stage has
 * no such board, or without Supabase env (CI, e2e): there is no demo data.
 */
export async function readClassificaTappa(
  tappaId: string,
  categoria: Categoria,
): Promise<ClassificaTappa | null> {
  if (!readSupabaseEnv()) return null;
  return leggiClassificaTappa(await createClient(), tappaId, categoria);
}
