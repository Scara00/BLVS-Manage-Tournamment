import "server-only";
import { timingSafeEqual } from "node:crypto";
import { jsonError } from "@/lib/api/responses";
import { chiudiDemoScadute } from "@/lib/demo/gestione-tappe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * The server-side deadline job: closes the registrations of every stage
 * whose deadline has passed (`chiudi_iscrizioni_scadute()`, run with the
 * secret key because there is no user). Answers `{ chiuse }`.
 */
export async function chiudiIscrizioniScadute(
  request: Request,
): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET non impostato");
    return jsonError(503, "Job non configurato.");
  }
  if (!isCronAuthorized(request)) return jsonError(401, "Non autorizzato.");

  if (!readSupabaseEnv()) {
    return Response.json({ chiuse: chiudiDemoScadute(now()) });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cron] SUPABASE_SECRET_KEY non impostata");
    return jsonError(503, "Job non configurato.");
  }
  const { data, error } = await supabase.rpc("chiudi_iscrizioni_scadute");
  if (error) {
    console.error("[cron] chiusura delle iscrizioni non riuscita", error);
    return jsonError(500, "Chiusura delle iscrizioni non riuscita.");
  }
  return Response.json({ chiuse: data as number });
}
