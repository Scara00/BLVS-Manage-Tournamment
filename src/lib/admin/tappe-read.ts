import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { demoAdminStages } from "@/lib/demo/tournament";
import { getServerTimeParts } from "@/lib/time/server-time";
import {
  demoAdminTappa,
  toAdminTappa,
  type AdminTappa,
  type AdminTappaRpcRow,
} from "./tappe";

/** Today in Europe/Rome as `YYYY-MM-DD`, comparable with `date` columns. */
function today(): string {
  const { year, month, day } = getServerTimeParts();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Every stage, drafts included, with registrations and seats per category
 * and the results still to enter. Admins only: a player gets 403. Without
 * Supabase env (CI, e2e) it returns the demo calendar.
 */
export const readAdminTappe = cache(async (): Promise<AdminTappa[]> => {
  await connection();
  const user = await requireAdmin();
  if (!user) return demoAdminStages.map(demoAdminTappa);

  const { data, error } = await user.supabase.rpc("admin_riepilogo_tappe");
  if (error) throw new Error(`admin_riepilogo_tappe: ${error.message}`);
  const oggi = today();
  return (data as AdminTappaRpcRow[]).map((row) => toAdminTappa(row, oggi));
});
