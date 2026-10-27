import "server-only";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDemoPunteggi } from "@/lib/demo/punteggi";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { leggiPunteggi } from "./dati";
import type { ElencoPunteggi, SchedaPunteggio } from "./types";

async function readElenco(
  tappaId: string,
  partitaId?: string,
): Promise<ElencoPunteggi> {
  await connection();
  if (!readSupabaseEnv()) {
    const elenco = getDemoPunteggi(tappaId);
    if (!elenco) notFound();
    return elenco;
  }
  if (!isUuid(tappaId) || (partitaId !== undefined && !isUuid(partitaId))) {
    notFound();
  }
  const user = await getCurrentUser();
  if (user?.ruolo !== "admin") forbidden();
  const elenco = await leggiPunteggi(user.supabase, tappaId, partitaId);
  if (!elenco) notFound();
  return elenco;
}

/**
 * w-admin-live: the group matches of a stage, read with the admin's
 * session (a player gets 403, an unknown stage 404). Without Supabase env
 * it reads the in-memory demo scores.
 */
export function readElencoPunteggi(tappaId: string): Promise<ElencoPunteggi> {
  return readElenco(tappaId);
}

/** w-admin-punteggio: one match of the stage, 404 when it isn't there. */
export async function readSchedaPunteggio(
  tappaId: string,
  partitaId: string,
): Promise<SchedaPunteggio> {
  const elenco = await readElenco(tappaId, partitaId);
  const partita = elenco.partite.find((p) => p.id === partitaId);
  if (!partita) notFound();
  return { tappa: elenco.tappa, partita };
}
