import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  demoRegistrations,
  demoStages,
  demoStandings,
} from "@/lib/demo/tournament";
import {
  toIscrizioneInAttesa,
  type AdminDashboard,
  type IscrizioneInAttesaRow,
} from "./dashboard-format";

/** How many pending registrations the dashboard lists. */
export const ULTIME_ISCRIZIONI = 5;

function demoDashboard(): AdminDashboard {
  return {
    tappe: demoStages.length,
    iscrizioniInAttesa: demoRegistrations.length,
    giocatori: demoStandings.length,
    ultimeIscrizioni: demoRegistrations.map((r) => ({
      id: r.id,
      player: r.pair,
      stage: r.stage,
      received: r.received,
    })),
  };
}

async function count(
  query: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>,
  what: string,
) {
  const { count: value, error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
  return value ?? 0;
}

async function readFromDb(supabase: SupabaseClient): Promise<AdminDashboard> {
  const head = { count: "exact", head: true } as const;
  const [tappe, iscrizioniInAttesa, giocatori, ultime] = await Promise.all([
    count(
      supabase.from("tappe").select("id", head).neq("stato", "annullata"),
      "tappe",
    ),
    count(
      supabase.from("iscrizioni").select("id", head).eq("stato", "in_attesa"),
      "iscrizioni",
    ),
    count(
      supabase.from("utenti").select("id", head).eq("ruolo", "giocatore"),
      "utenti",
    ),
    supabase
      .from("iscrizioni")
      .select("id, created_at, utente:utenti(nome, cognome), tappa:tappe(nome)")
      .eq("stato", "in_attesa")
      .order("created_at", { ascending: false })
      .limit(ULTIME_ISCRIZIONI),
  ]);
  if (ultime.error) throw new Error(`iscrizioni: ${ultime.error.message}`);

  return {
    tappe,
    iscrizioniInAttesa,
    giocatori,
    ultimeIscrizioni: (ultime.data as unknown as IscrizioneInAttesaRow[]).map(
      toIscrizioneInAttesa,
    ),
  };
}

/**
 * Admin dashboard figures, read through RLS with the admin's session. A
 * signed-in player gets 403 (the proxy already sends anonymous users to
 * the login). Without Supabase env (CI, e2e) it returns the demo figures.
 */
export async function readAdminDashboard(): Promise<AdminDashboard> {
  const user = await requireAdmin();
  if (!user) return demoDashboard();
  return readFromDb(user.supabase);
}
