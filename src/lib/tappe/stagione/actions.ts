"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { pubblicaClassificaGenerale } from "@/lib/classifica-generale/pubblica";
import { calcolaClassificaGenerale } from "@/lib/classifica-generale/read";
import { CATEGORIE } from "@/lib/db/types";
import { publishOverallPlayerStandings } from "@/lib/live/publish";
import { parseStagione } from "@/lib/classifica-generale/stagione";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { GESTIONE_MESSAGES, type MotivoErrore } from "../gestione-state";
import { impostaDemoStagione } from "./demo";
import { STAGIONE_MESSAGES, type StagioneState } from "./types";

type PgError = { code?: string; hint?: string | null; message?: string };

/**
 * «Salva la stagione» (w-admin-tappa): sets `tappe.stagione` through RPC
 * `imposta_stagione_tappa` (admin only, refused once archived), then
 * republishes the overall standing of the new season.
 */
export async function impostaStagioneTappa(
  _prev: StagioneState,
  formData: FormData,
): Promise<StagioneState> {
  const at = now().getTime();
  const fail = (
    reason: MotivoErrore,
    message: string,
    campo?: string,
  ): StagioneState => ({ status: "error", reason, message, campo, at });

  const tappaId = String(formData.get("tappaId") ?? "");
  const stagione = parseStagione(formData.get("stagione"));
  if (stagione === null) {
    return fail(
      "invalid",
      STAGIONE_MESSAGES.invalida,
      STAGIONE_MESSAGES.invalida,
    );
  }
  const success: StagioneState = {
    status: "success",
    stagione,
    message: STAGIONE_MESSAGES.salvata(stagione),
    at,
  };

  if (!readSupabaseEnv()) {
    const tappa = getDemoTappaGestione(tappaId);
    if (!tappa) return fail("conflict", STAGIONE_MESSAGES.nonTrovata);
    if (tappa.row.stato === "archiviata") {
      return fail("invalid", STAGIONE_MESSAGES.archiviata);
    }
    impostaDemoStagione(tappaId, stagione);
    refresh();
    return success;
  }

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[stagione] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return fail("sessionExpired", GESTIONE_MESSAGES.sessionExpired);
  if (user.ruolo !== "admin") {
    return fail("permissionDenied", GESTIONE_MESSAGES.permissionDenied);
  }
  if (!isUuid(tappaId)) return fail("conflict", STAGIONE_MESSAGES.nonTrovata);

  const { data: prima } = await user.supabase
    .from("tappe")
    .select("stagione")
    .eq("id", tappaId)
    .maybeSingle<{ stagione: number }>();
  const { error } = await user.supabase.rpc("imposta_stagione_tappa", {
    p_tappa: tappaId,
    p_stagione: stagione,
  });
  if (error) {
    const e = error as PgError;
    if (e.code === "42501") {
      return fail("permissionDenied", GESTIONE_MESSAGES.permissionDenied);
    }
    if (e.code === "P0002")
      return fail("conflict", STAGIONE_MESSAGES.nonTrovata);
    if (e.hint === "tappa_archiviata") {
      return fail("invalid", STAGIONE_MESSAGES.archiviata);
    }
    if (e.hint === "stagione_non_valida") {
      return fail(
        "invalid",
        STAGIONE_MESSAGES.invalida,
        STAGIONE_MESSAGES.invalida,
      );
    }
    console.error("[stagione] salvataggio non riuscito", error);
    return fail("network", GESTIONE_MESSAGES.network);
  }

  // Both seasons change: the one the stage left and the one it joined.
  await pubblicaClassificaGenerale(tappaId);
  if (prima && prima.stagione !== stagione) {
    await pubblicaStagione(prima.stagione);
  }
  refresh();
  return success;
}

async function pubblicaStagione(stagione: number) {
  try {
    for (const categoria of CATEGORIE) {
      publishOverallPlayerStandings(
        await calcolaClassificaGenerale(categoria, stagione),
      );
    }
  } catch (error) {
    console.error("[stagione] pubblicazione non riuscita", error);
  }
}
