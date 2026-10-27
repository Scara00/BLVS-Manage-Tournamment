import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { STATI_TAPPA, type StatoTappa } from "@/lib/db/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { creaDemoTappa } from "./gestione-tappe";

/** Demo/test only: `TAPPE_DEMO_SEED=true` and no Supabase env. */
export function isDemoSeedEnabled(): boolean {
  return process.env.TAPPE_DEMO_SEED === "true" && !readSupabaseEnv();
}

/** Creates a demo stage for one e2e test; answers `{ id }`. */
export async function creaDemoTappaRoute(request: Request): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  const stato = (STATI_TAPPA as readonly unknown[]).includes(body.stato)
    ? (body.stato as StatoTappa)
    : "bozza";
  const chiudonoIl =
    typeof body.chiudonoIl === "string" &&
    !Number.isNaN(new Date(body.chiudonoIl).getTime())
      ? new Date(body.chiudonoIl).toISOString()
      : null;
  const nome =
    typeof body.nome === "string" ? body.nome.slice(0, 200) : undefined;
  const posti =
    Number.isInteger(body.posti) &&
    (body.posti as number) >= 5 &&
    (body.posti as number) <= 256
      ? (body.posti as number)
      : undefined;
  return Response.json(
    { id: creaDemoTappa({ stato, chiudonoIl, nome, posti }) },
    { status: 201 },
  );
}
