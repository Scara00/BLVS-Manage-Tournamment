import "server-only";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { inProva, type ConProva } from "./prova";

/**
 * True when the signed-in user is looking at a «tappa di prova»: RLS
 * shows that draft to admins only, so players always get false.
 */
export async function leggiTappaInProva(id: string): Promise<boolean> {
  await connection();
  if (!readSupabaseEnv()) {
    const row = getDemoTappaGestione(id)?.row;
    return row ? inProva(row) : false;
  }
  if (!isUuid(id)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tappe")
    .select("stato, prova")
    .eq("id", id)
    .maybeSingle<ConProva>();
  if (error) {
    console.error("[tappe] lettura della tappa di prova non riuscita", error);
    return false;
  }
  return data !== null && inProva(data);
}
