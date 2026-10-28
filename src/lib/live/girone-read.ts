import "server-only";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { CATEGORIE, type Categoria, type FaseGirone } from "@/lib/db/types";
import { getDemoGironiGiocati } from "@/lib/demo/avvio-fase";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { GironeInfo } from "./girone";
import type { LiveMe } from "./tappa";
import { readLiveTappa } from "./tappa-read";
import type { LiveSync } from "./types";

export type GironeLive = GironeInfo & { categoria: Categoria };

export type LiveGironePagina =
  | { status: "notFound" }
  | { status: "sessionExpired"; tappa: { id: string; nome: string } }
  | {
      status: "ok";
      tappa: { id: string; nome: string };
      girone: GironeLive;
      sync: LiveSync;
      me: LiveMe;
    };

/** Demo groups: the played groups of the started demo boards. */
function demoGirone(tappaId: string, gironeId: string): GironeLive | null {
  for (const categoria of CATEGORIE) {
    const gironi = getDemoGironiGiocati(tappaId, categoria);
    const girone = gironi.find((g) => g.id === gironeId);
    if (!girone) continue;
    const fase = girone.fase ?? "iniziale";
    return {
      id: girone.id,
      nome: girone.nome,
      fase,
      gironiDellaFase: gironi.filter((g) => (g.fase ?? "iniziale") === fase)
        .length,
      categoria,
    };
  }
  return null;
}

type GironeRow = {
  id: string;
  nome: string;
  fase: FaseGirone;
  tabellone_id: string;
  tabelloni: { tappa_id: string; categoria: Categoria } | null;
};

/** The group, when it belongs to the stage (gironi are public, RLS). */
async function dbGirone(
  tappaId: string,
  gironeId: string,
): Promise<GironeLive | null> {
  if (!isUuid(gironeId)) return null;
  const supabase = await createClient();
  const { data: girone, error } = await supabase
    .from("gironi")
    .select(
      "id, nome, fase, tabellone_id, tabelloni!inner (tappa_id, categoria)",
    )
    .eq("id", gironeId)
    .eq("tabelloni.tappa_id", tappaId)
    .maybeSingle<GironeRow>();
  if (error) throw new Error(`girone: ${error.message}`);
  if (!girone?.tabelloni) return null;
  const { count } = await supabase
    .from("gironi")
    .select("id", { count: "exact", head: true })
    .eq("tabellone_id", girone.tabellone_id)
    .eq("fase", girone.fase);
  return {
    id: girone.id,
    nome: girone.nome,
    fase: girone.fase,
    gironiDellaFase: count ?? 1,
    categoria: girone.tabelloni.categoria,
  };
}

/**
 * w-girone of a stage (BLVS-47): the stage's live data, the player and the
 * group. Same access as w-live: signed-in players only.
 */
export async function readLiveGirone(
  tappaId: string,
  gironeId: string,
): Promise<LiveGironePagina> {
  await connection();
  const live = await readLiveTappa(tappaId);
  if (live.status !== "ok") return live;
  const girone = readSupabaseEnv()
    ? await dbGirone(tappaId, gironeId)
    : demoGirone(tappaId, gironeId);
  if (!girone) return { status: "notFound" };
  return {
    status: "ok",
    tappa: live.tappa,
    girone,
    sync: live.sync,
    me: live.me,
  };
}
