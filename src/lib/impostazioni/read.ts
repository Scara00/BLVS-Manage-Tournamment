import "server-only";
import { cookies } from "next/headers";
import { anteprimaCancellazione } from "@/lib/cancellazione/anteprima";
import { getCurrentUser } from "@/lib/auth/session";
import { readClassificaGenerale } from "@/lib/classifica-generale/read";
import {
  DEMO_ACCOUNT_CANCELLATO_COOKIE,
  DEMO_CONSENSO,
  DEMO_IMPOSTAZIONI,
} from "@/lib/demo/impostazioni";
import { readProfiloRow } from "@/lib/profilo/read";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsensoPrivacy, Impostazioni, RigaPubblica } from "./types";

/** The latest privacy consent of the player, through RLS `consensi_select`. */
export async function readConsensoPrivacy(
  supabase: SupabaseClient,
  utenteId: string,
): Promise<ConsensoPrivacy | null> {
  const { data, error } = await supabase
    .from("consensi")
    .select("versione_informativa, data_informativa, created_at")
    .eq("utente_id", utenteId)
    .eq("tipo", "privacy")
    .eq("concesso", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      versione_informativa: string;
      data_informativa: string | null;
      created_at: string;
    }>();
  if (error) throw new Error(`consensi: ${error.message}`);
  return data
    ? {
        versione: data.versione_informativa,
        dataInformativa: data.data_informativa,
        accettatoIl: data.created_at,
      }
    : null;
}

/**
 * The player's row in the overall standing of their category and the
 * newest season (what /classifica opens on), with the same row after a
 * deletion. Computed like w-classifica (BLVS-44), so the preview matches.
 */
export async function readRigaPubblica(): Promise<RigaPubblica | null> {
  const vista = await readClassificaGenerale({});
  const classifica = vista.sync.snapshot.overallStandings?.[0];
  if (!vista.me || !classifica) return null;
  const anteprima = anteprimaCancellazione(classifica, vista.me);
  return anteprima
    ? { ...anteprima, categoria: vista.categoria, stagione: vista.stagione }
    : null;
}

/** w-impostazioni for the signed-in player, or `null` without a session. */
export async function getImpostazioni(): Promise<Impostazioni | null> {
  if (!readSupabaseEnv()) {
    const jar = await cookies();
    if (jar.get(DEMO_ACCOUNT_CANCELLATO_COOKIE)) return null;
    return {
      ...DEMO_IMPOSTAZIONI,
      consenso: DEMO_CONSENSO,
      riga: await readRigaPubblica(),
    };
  }
  const user = await getCurrentUser();
  if (!user) return null;
  const [row, consenso, riga] = await Promise.all([
    readProfiloRow(user.supabase, user.id),
    readConsensoPrivacy(user.supabase, user.id),
    readRigaPubblica(),
  ]);
  return {
    nome: row.nome,
    cognome: row.cognome,
    email: row.email,
    consenso,
    riga,
  };
}
