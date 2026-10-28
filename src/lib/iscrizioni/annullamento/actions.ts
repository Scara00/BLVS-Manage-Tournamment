"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DEMO_GIOCATORE_COOKIE,
  demoAnnullaPosto,
  demoDettaglioTappa,
  demoIscrizione,
} from "@/lib/demo/tappa-dettaglio";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { ANNULLA_MESSAGES, statoDaErrore } from "./errori";
import { puoAnnullare, testoNonAnnullabile } from "./regola";
import {
  messaggioAnnullata,
  prossimoTentativo,
  type AnnullaIscrizioneState,
} from "./state";

function campo(formData: FormData, nome: string): string {
  const valore = formData.get(nome);
  return typeof valore === "string" ? valore : "";
}

/**
 * «Annulla l'iscrizione» (w-annulla-iscrizione): the signed-in player
 * cancels their own registration. Every rule (own row, still active, stage
 * not started, deadline on the server clock, not in a group yet) is
 * checked by RPC `annulla_iscrizione()`, which frees the seat and writes
 * the registro. The page is refreshed so lists and counters update.
 */
export async function annullaIscrizione(
  prev: AnnullaIscrizioneState,
  formData: FormData,
): Promise<AnnullaIscrizioneState> {
  const attempt = prossimoTentativo(prev);
  const iscrizioneId = campo(formData, "iscrizioneId");
  const tappaId = campo(formData, "tappaId");
  const tappa = campo(formData, "tappa").slice(0, 200) || "la tappa";

  if (!readSupabaseEnv()) return annullaDemo(tappaId, tappa, attempt);

  if (!isUuid(iscrizioneId))
    return {
      status: "error",
      reason: "notFound",
      message: ANNULLA_MESSAGES.notFound,
      attempt,
    };
  const user = await getCurrentUser();
  if (!user)
    return {
      status: "error",
      reason: "sessionExpired",
      message: ANNULLA_MESSAGES.sessionExpired,
      attempt,
    };

  const { data, error } = await user.supabase
    .rpc("annulla_iscrizione", { p_iscrizione: iscrizioneId })
    .select("tappa_id, posto")
    .single<{ tappa_id: string; posto: number | null }>();
  if (error) {
    refresh();
    return statoDaErrore(error, attempt);
  }
  refresh();
  return {
    status: "success",
    tappaId: data.tappa_id,
    posto: data.posto,
    message: messaggioAnnullata(tappa, data.posto),
    attempt,
  };
}

/** Demo (no Supabase env): the same rules on the in-memory demo data. */
async function annullaDemo(
  tappaId: string,
  tappa: string,
  attempt: number,
): Promise<AnnullaIscrizioneState> {
  const giocatore = (await cookies()).get(DEMO_GIOCATORE_COOKIE)?.value;
  const row = demoDettaglioTappa(tappaId);
  const iscrizione = demoIscrizione(giocatore, tappaId);
  if (!row || !iscrizione)
    return {
      status: "error",
      reason: "notFound",
      message: ANNULLA_MESSAGES.notFound,
      attempt,
    };
  const esito = puoAnnullare(
    { stato: iscrizione.stato, inGirone: false, tappa: row },
    now(),
  );
  if (!esito.possibile) {
    refresh();
    return {
      status: "error",
      reason: "refused",
      message:
        testoNonAnnullabile(esito.motivo, esito.scadenza) ??
        ANNULLA_MESSAGES.nonAttiva,
      attempt,
    };
  }
  const posto = demoAnnullaPosto(giocatore, tappaId);
  refresh();
  return {
    status: "success",
    tappaId,
    posto,
    message: messaggioAnnullata(tappa, posto),
    attempt,
  };
}
