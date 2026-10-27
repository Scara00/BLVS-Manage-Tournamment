"use server";

import { cookies } from "next/headers";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Punteggio } from "@/lib/db/types";
import {
  DEMO_SESSIONE_CHIUSA_COOKIE,
  salvaDemoPunteggio,
} from "@/lib/demo/coda-punteggi";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { esitoErroreSalvataggio } from "./errori";
import {
  CODA_MESSAGES as M,
  type EsitoInvio,
  type InvioPunteggio,
} from "./types";
import { leggiInvio } from "./validation";

type RispostaRpc = {
  punteggio: Pick<Punteggio, "sets" | "versione">;
  duplicato: boolean;
};

/**
 * Sends one score of the device queue (BLVS-33) through RPC
 * `salva_punteggio_coda`, which saves each `chiave` once: a repeated send
 * (lost answer, two tabs, resume after login) never saves twice.
 * Only the admin who entered the score sends it: with no session, or with
 * another account signed in, the score stays on the device.
 * Without Supabase env it saves into the in-memory demo store; the demo
 * cookie `blvs_demo_sessione_chiusa` simulates a closed session for e2e.
 */
export async function inviaPunteggioCoda(
  raw: InvioPunteggio,
): Promise<EsitoInvio> {
  const invio = leggiInvio(raw);
  if (!invio) return { status: "rifiutato", message: M.rifiutato.sets };

  if (!readSupabaseEnv()) {
    const jar = await cookies();
    if (jar.get(DEMO_SESSIONE_CHIUSA_COOKIE)?.value === "1")
      return { status: "sessionExpired" };
    return salvaDemoPunteggio(invio);
  }

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error(
      "[coda-punteggi] verifica della sessione non riuscita",
      error,
    );
    return { status: "errore" };
  }
  if (!user) return { status: "sessionExpired" };
  if (user.ruolo !== "admin") return { status: "altroAccount" };
  if (invio.autoreId && invio.autoreId !== user.id)
    return { status: "altroAccount" };

  const { data, error } = await user.supabase.rpc("salva_punteggio_coda", {
    p_partita: invio.partitaId,
    p_versione: invio.versione,
    p_sets: invio.sets,
    p_chiave: invio.chiave,
  });

  if (!error) {
    const r = data as RispostaRpc;
    // TODO(BLVS-32): publishScore / publishPendingScores after a real
    // write (not on `duplicato`), once the score screen builds the match.
    return {
      status: "salvato",
      punteggio: { sets: r.punteggio.sets, versione: r.punteggio.versione },
      duplicato: r.duplicato,
    };
  }

  const esito = esitoErroreSalvataggio(error);
  if (esito.status !== "conflitto") {
    if (esito.status === "errore")
      console.error("[coda-punteggi] salvataggio non riuscito", error);
    return esito;
  }
  // Conflict: the admin chooses between the two scores, so read the other one.
  const current = await user.supabase
    .from("punteggi")
    .select("sets, versione")
    .eq("partita_id", invio.partitaId)
    .maybeSingle<Pick<Punteggio, "sets" | "versione">>();
  if (current.error || !current.data) return { status: "errore" };
  return { status: "conflitto", punteggio: current.data };
}
