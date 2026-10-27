import "server-only";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { getDemoTabelloneLive } from "@/lib/demo/admin-live";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { leggiTabelloneLive } from "./dati";
import type { TabelloneLive } from "./types";

/**
 * w-admin-live of one board, read through RLS with the admin's session: a
 * player gets 403, an unknown stage 404. Without Supabase env it reads the
 * in-memory demo matches.
 */
export async function readAdminLive(
  tappaId: string,
  categoria: Categoria,
): Promise<TabelloneLive> {
  await connection();
  if (!readSupabaseEnv()) {
    const tabellone = getDemoTabelloneLive(tappaId, categoria, now());
    if (!tabellone) notFound();
    return tabellone;
  }

  if (!isUuid(tappaId)) notFound();
  const user = await getCurrentUser();
  if (user?.ruolo !== "admin") forbidden();
  const tabellone = await leggiTabelloneLive(
    user.supabase,
    tappaId,
    categoria,
    now(),
  );
  if (!tabellone) notFound();
  return tabellone;
}
