import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/session";
import { getDemoPunteggiPersi } from "@/lib/demo/rigenera-gironi";
import type { EditorGironi } from "@/lib/gironi/editor/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { toPunteggiPersi, type PunteggioPersoRow } from "./format";
import type { PunteggioPerso, RigenerazioneTabellone } from "./types";

/** The scores a regeneration of the board would delete (admin only). */
export async function leggiPunteggiPersi(
  supabase: SupabaseClient,
  tabelloneId: string,
): Promise<PunteggioPerso[]> {
  const { data, error } = await supabase.rpc("punteggi_rigenerazione", {
    p_tabellone: tabelloneId,
  });
  if (error) throw new Error(`punteggi_rigenerazione: ${error.message}`);
  return toPunteggiPersi((data ?? []) as PunteggioPersoRow[]);
}

/**
 * What w-admin-gironi needs for «Rigenera gironi», read after the editor
 * (which already checked the admin role and found the board). Without
 * Supabase env it reads the in-memory demo scores.
 */
export async function readRigenerazione(
  editor: EditorGironi,
): Promise<RigenerazioneTabellone> {
  const { tappa, categoria, composizione } = editor;
  if (!readSupabaseEnv()) {
    return {
      tappaId: tappa.id,
      categoria,
      punteggi: getDemoPunteggiPersi(tappa.id, categoria),
    };
  }
  const user = await getCurrentUser();
  if (!user) throw new Error("rigenerazione: sessione assente");
  return {
    tappaId: tappa.id,
    categoria,
    punteggi: await leggiPunteggiPersi(user.supabase, composizione.tabelloneId),
  };
}
