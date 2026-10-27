import "server-only";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ClassificaGirone } from "./classifica";
import { leggiClassificaGirone } from "./dati";

/**
 * The standing of one group, recomputed from its matches on every call.
 * Null when the group doesn't exist, or without Supabase env (CI, e2e):
 * the live pages still show the demo standings until a UI task wires this.
 */
export async function readClassificaGirone(
  gironeId: string,
): Promise<ClassificaGirone | null> {
  if (!readSupabaseEnv()) return null;
  return leggiClassificaGirone(await createClient(), gironeId);
}
