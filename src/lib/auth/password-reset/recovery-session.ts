import type { SupabaseClient } from "@supabase/supabase-js";
import { now } from "@/lib/time/server-time";
import { RESET_LINK_VALIDITY_MINUTES } from "./messages";

/**
 * Whether the session in the cookies was opened by a recovery link in the
 * last hour (`amr` claim `{ method: "recovery", timestamp }`). It lets the
 * user retry the save after the token was spent but the update failed
 * (e.g. the new password equals the old one) without asking a new link.
 */
export async function hasRecentRecoverySession(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return false;
  const since = now().getTime() - RESET_LINK_VALIDITY_MINUTES * 60_000;
  const amr: unknown[] = Array.isArray(data.claims.amr) ? data.claims.amr : [];
  return amr.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "method" in entry &&
      entry.method === "recovery" &&
      "timestamp" in entry &&
      typeof entry.timestamp === "number" &&
      entry.timestamp * 1000 >= since,
  );
}
