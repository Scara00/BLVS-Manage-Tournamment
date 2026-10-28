"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/api/validation";
import {
  emailVerifyHref,
  rememberReturnAfterConfirmation,
} from "@/lib/auth/email-verification/return-path";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DEMO_GIOCATORE_COOKIE,
  demoDettaglioTappa,
  demoPostoPreso,
  demoPrendiPosto,
  demoTabelloniTappa,
} from "@/lib/demo/tappa-dettaglio";
import { demoTappeGiocatore } from "@/lib/demo/tournament";
import { loginHref } from "@/lib/navigation/auth-paths";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { toTappaDettaglio } from "@/lib/tappe/dettaglio";
import { iscrizioneHref, tappaHref } from "@/lib/tappe/paths";
import { now } from "@/lib/time/server-time";
import { iscriviGiocatore } from "./iscrivi";
import { TAPPA_NON_TROVATA_MESSAGE } from "./messages";
import type { PrendiPostoState } from "./prendi-posto-state";

function failure(prev: PrendiPostoState, message: string): PrendiPostoState {
  const attempt = prev.status === "error" ? prev.attempt + 1 : 1;
  return { status: "error", message, attempt };
}

/**
 * «Prendi il posto N»: the signed-in player takes a seat at the stage named
 * by the `tappaId` field. On success it goes to the confirmation
 * (w-iscrizione-ok); with an unconfirmed email to w-email-verify, which
 * then brings the player back to the stage. Any other refusal (sold out in
 * the meantime, closed, deadline passed) is returned as a message and the
 * page is refreshed so the button shows the new reason.
 */
export async function prendiPosto(
  prev: PrendiPostoState,
  formData: FormData,
): Promise<PrendiPostoState> {
  const tappaId = formData.get("tappaId");
  if (typeof tappaId !== "string" || tappaId === "")
    return failure(prev, TAPPA_NON_TROVATA_MESSAGE);

  if (!readSupabaseEnv()) return prendiPostoDemo(prev, tappaId);

  if (!isUuid(tappaId)) return failure(prev, TAPPA_NON_TROVATA_MESSAGE);
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(tappaHref(tappaId)));

  const esito = await iscriviGiocatore(user.supabase, tappaId);
  if (esito.ok) redirect(iscrizioneHref(tappaId));
  if (esito.motivo === "email_non_confermata") {
    await rememberReturnAfterConfirmation(tappaHref(tappaId));
    redirect(emailVerifyHref(tappaHref(tappaId)));
  }
  refresh();
  return failure(prev, esito.message);
}

/** Demo (no Supabase env): the same rules on the in-memory demo data. */
async function prendiPostoDemo(
  prev: PrendiPostoState,
  tappaId: string,
): Promise<PrendiPostoState> {
  const row = demoDettaglioTappa(tappaId);
  if (!row || row.stato === "bozza")
    return failure(prev, TAPPA_NON_TROVATA_MESSAGE);

  const store = await cookies();
  let giocatore = store.get(DEMO_GIOCATORE_COOKIE)?.value;
  const preso = demoPostoPreso(giocatore, tappaId);
  const categoria = demoTappeGiocatore.categoria;
  const dettaglio = toTappaDettaglio(
    row,
    demoTabelloniTappa(tappaId, preso ? 1 : 0),
    {
      categoria,
      iscrizione: preso
        ? { id: tappaId, posto: preso, stato: "in_attesa", categoria }
        : null,
      at: now(),
    },
  );
  if (dettaglio.motivoTesto) {
    refresh();
    return failure(prev, dettaglio.motivoTesto);
  }

  if (!giocatore) {
    giocatore = randomUUID();
    store.set(DEMO_GIOCATORE_COOKIE, giocatore, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  demoPrendiPosto(giocatore, tappaId);
  redirect(iscrizioneHref(tappaId));
}
