import "server-only";
import { isUuid } from "@/lib/api/validation";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getDemoStagione } from "./demo";

export type StagioneTappa = {
  stagione: number;
  /** False once archived: the DB refuses any change. */
  modificabile: boolean;
};

/** The season of a stage for w-admin-tappa, or null when it doesn't exist. */
export async function readStagioneTappa(
  tappaId: string,
): Promise<StagioneTappa | null> {
  if (!readSupabaseEnv()) {
    const tappa = getDemoTappaGestione(tappaId);
    if (!tappa) return null;
    return {
      stagione: getDemoStagione(tappaId, tappa.row.data_inizio),
      modificabile: tappa.row.stato !== "archiviata",
    };
  }
  if (!isUuid(tappaId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tappe")
    .select("stagione, stato")
    .eq("id", tappaId)
    .maybeSingle<{ stagione: number; stato: string }>();
  if (error) throw new Error(`stagione: ${error.message}`);
  if (!data) return null;
  return { stagione: data.stagione, modificabile: data.stato !== "archiviata" };
}
