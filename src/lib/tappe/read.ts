import "server-only";
import { demoStages } from "@/lib/demo/tournament";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  demoTappaCard,
  toTappaCard,
  type TappaCard,
  type TappaRow,
} from "./format";

/**
 * The stage calendar, oldest first. Drafts are left out for everyone:
 * RLS hides them from players, and admins see them only in the admin
 * dashboard. Without Supabase env (CI, e2e) it returns the demo stages.
 */
export async function readTappe(): Promise<TappaCard[]> {
  if (!readSupabaseEnv()) return demoStages.map(demoTappaCard);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tappe")
    .select("id, nome, luogo, data_inizio, data_fine, stato")
    .neq("stato", "bozza")
    .order("data_inizio", { ascending: true });
  if (error) throw new Error(`tappe: ${error.message}`);
  return (data as TappaRow[]).map(toTappaCard);
}
