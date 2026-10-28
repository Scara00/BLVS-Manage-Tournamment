import "server-only";
import type { Categoria } from "@/lib/db/types";
import { classificaTappaDemo } from "@/lib/demo/admin-live";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ClassificaTappa } from "./classifica";
import { leggiClassificaTappa } from "./dati";

/**
 * The stage standing of one category, recomputed on every call, so a
 * corrected score or a withdrawal shows at once. Null when the stage has
 * no such board. Without Supabase env (CI, e2e) it reads w-admin-live's
 * demo finals (BLVS-43).
 */
export async function readClassificaTappa(
  tappaId: string,
  categoria: Categoria,
): Promise<ClassificaTappa | null> {
  if (!readSupabaseEnv()) return classificaTappaDemo(tappaId, categoria);
  return leggiClassificaTappa(await createClient(), tappaId, categoria);
}
