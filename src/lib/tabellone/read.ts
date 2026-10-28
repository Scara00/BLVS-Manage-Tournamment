import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import { demoMeTabellone, getDemoDatiTabellone } from "@/lib/demo/tabellone";
import { getLiveBus } from "@/lib/live/bus";
import type { LiveSync } from "@/lib/live/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { now } from "@/lib/time/server-time";
import {
  datiDaRpc,
  vistaTabellone,
  type DatiTabellone,
  type RpcTabellone,
} from "./dati";
import type { MeTabellone } from "./posizione";
import type { StageBoard } from "./types";

export type VistaTabelloneGiocatore =
  | { status: "notFound" }
  | { status: "sessionExpired"; tappa: { id: string; nome: string } }
  | {
      status: "ok";
      tappa: { id: string; nome: string };
      sync: LiveSync;
      me: MeTabellone;
    };

/** The stage's data through the security-definer RPC; null = not found. */
export async function leggiDatiTabellone(
  supabase: SupabaseClient,
  tappaId: string,
): Promise<DatiTabellone | null> {
  const { data, error } = await supabase.rpc("tabellone_giocatore_dati", {
    p_tappa: tappaId,
  });
  if (error) throw new Error(`tabellone: ${error.message}`);
  return data ? datiDaRpc(data as RpcTabellone) : null;
}

/**
 * Both boards of a stage, recomputed now: the demo stores without env,
 * otherwise the RPC with the caller's session. Null when not found.
 */
export async function calcolaTabellone(
  tappaId: string,
  change: string | null = null,
): Promise<StageBoard | null> {
  const dati = !readSupabaseEnv()
    ? getDemoDatiTabellone(tappaId)
    : isUuid(tappaId)
      ? await leggiDatiTabellone(await createClient(), tappaId)
      : null;
  return dati
    ? vistaTabellone(dati, { change, updatedAt: now().toISOString() })
    : null;
}

function syncDi(board: StageBoard | null): LiveSync {
  const bus = getLiveBus().snapshot();
  return {
    snapshot: {
      ...bus,
      matches: [],
      groups: [],
      overall: [],
      pendingScores: [],
      phases: [],
      boards: [],
      stageBoards: board ? [board] : [],
    },
    syncedAt: now().toISOString(),
  };
}

/** The resync of w-tabellone (`/api/live/snapshot?gironi=<tappa>`). */
export async function readTabelloneSync(tappaId: string): Promise<LiveSync> {
  await connection();
  try {
    return syncDi(await calcolaTabellone(tappaId));
  } catch (error) {
    console.error("[tabellone] lettura non riuscita", error);
    return syncDi(null);
  }
}

/** w-tabellone of a stage for the signed-in player (BLVS-48). */
export async function readTabelloneGiocatore(
  tappaId: string,
): Promise<VistaTabelloneGiocatore> {
  await connection();
  if (!readSupabaseEnv()) {
    const dati = getDemoDatiTabellone(tappaId);
    if (!dati) return { status: "notFound" };
    const board = vistaTabellone(dati, { updatedAt: now().toISOString() });
    return {
      status: "ok",
      tappa: { id: dati.tappa.id, nome: dati.tappa.nome },
      sync: syncDi(board),
      me: demoMeTabellone(dati),
    };
  }

  if (!isUuid(tappaId)) return { status: "notFound" };
  const supabase = await createClient();
  const { data: tappa, error } = await supabase
    .from("tappe")
    .select("id, nome")
    .eq("id", tappaId)
    .neq("stato", "bozza")
    .maybeSingle<{ id: string; nome: string }>();
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!tappa) return { status: "notFound" };

  // Players only (client decision): names are shown to signed-in users.
  const user = await getCurrentUser();
  if (!user) return { status: "sessionExpired", tappa };
  const [dati, { data: iscrizione }] = await Promise.all([
    leggiDatiTabellone(user.supabase, tappaId),
    user.supabase
      .from("iscrizioni")
      .select("id")
      .eq("tappa_id", tappaId)
      .eq("utente_id", user.id)
      .maybeSingle<{ id: string }>(),
  ]);
  if (!dati) return { status: "notFound" };
  return {
    status: "ok",
    tappa,
    sync: syncDi(vistaTabellone(dati, { updatedAt: now().toISOString() })),
    me: iscrizione?.id ?? null,
  };
}
