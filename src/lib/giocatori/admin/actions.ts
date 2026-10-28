"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { pubblicaClassificaGenerale } from "@/lib/classifica-generale/pubblica";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import {
  cambiaCategoriaDemo,
  verificaCategoriaDemo,
} from "@/lib/demo/giocatori-admin";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { pubblicaGironiTappa } from "@/lib/tabellone/pubblica";
import { now } from "@/lib/time/server-time";
import { leggiAttesi, messaggioCambio } from "./effetti";
import { erroreCambio, messaggioErrore } from "./errori";
import type { CambioCategoriaState, ErroreCambio } from "./types";

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/**
 * The admin role is verified on the server for every call; the RPCs check
 * it again. Without Supabase env the demo players are used, as by the read.
 */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[giocatori] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function fallimento(
  reason: ErroreCambio,
  dettaglio?: string | null,
): CambioCategoriaState {
  // The page re-reads the effects, so the dialog shows the new ones.
  if (reason === "effettiCambiati") refresh();
  return {
    status: "error",
    reason,
    message: messaggioErrore(reason, dettaglio),
    at: now().getTime(),
  };
}

function successo(message: string): CambioCategoriaState {
  refresh();
  return { status: "success", message, at: now().getTime() };
}

/** Max length of the note written in the registro. */
const NOTA_MAX = 400;

type EsitoRpc = {
  iscrizioni: { tappa_id: string }[];
  tappe_classifica: string[];
};

/**
 * w-admin-categoria-conferma: changes the category of `utenteId` to
 * `categoria`. `attesi` are the moves the admin saw; the RPC refuses
 * (`effettiCambiati`) when they no longer match. After the commit the
 * overall standings of every season the player played are republished
 * (both categories), and the boards of the stages whose registrations moved.
 */
export async function cambiaCategoria(
  _prev: CambioCategoriaState,
  formData: FormData,
): Promise<CambioCategoriaState> {
  const sessione = await sessioneAdmin();
  if (!sessione.ok) return fallimento(sessione.reason);

  const utenteId = text(formData.get("utenteId"));
  const categoria = text(formData.get("categoria"));
  const attesi = leggiAttesi(text(formData.get("attesi")) || "[]");
  const nota = text(formData.get("nota")).trim().slice(0, NOTA_MAX);
  if (
    !utenteId ||
    !(CATEGORIE as readonly string[]).includes(categoria) ||
    !attesi
  ) {
    return fallimento("invalid");
  }
  const a = categoria as Categoria;

  if (!sessione.supabase) {
    const esito = cambiaCategoriaDemo(utenteId, a, attesi);
    if (!esito.ok) return fallimento(esito.reason, esito.dettaglio);
    return successo(messaggioCambio(esito.nome, a, esito.spostate));
  }

  if (!isUuid(utenteId)) return fallimento("giocatoreNonTrovato");
  try {
    const { data, error } = await sessione.supabase.rpc(
      "admin_cambia_categoria",
      {
        p_utente: utenteId,
        p_categoria: a,
        p_attesi: attesi,
        p_nota: nota || null,
      },
    );
    if (error) return fallimento(erroreCambio(error), error.details);
    const esito = data as EsitoRpc;

    for (const tappaId of esito.tappe_classifica ?? []) {
      await pubblicaClassificaGenerale(tappaId, "Cambio di categoria");
    }
    for (const tappaId of new Set(esito.iscrizioni.map((i) => i.tappa_id))) {
      await pubblicaGironiTappa(tappaId);
    }

    const { data: utente } = await sessione.supabase
      .from("utenti")
      .select("nome, cognome")
      .eq("id", utenteId)
      .maybeSingle<{ nome: string; cognome: string }>();
    const nome = utente
      ? `${utente.nome} ${utente.cognome}`.trim()
      : "del giocatore";
    return successo(messaggioCambio(nome, a, esito.iscrizioni.length));
  } catch (error) {
    console.error("[giocatori] cambio di categoria non riuscito", error);
    return fallimento("network");
  }
}

/** «Segna come verificata»: the category stops being «da verificare». */
export async function verificaCategoria(
  _prev: CambioCategoriaState,
  formData: FormData,
): Promise<CambioCategoriaState> {
  const sessione = await sessioneAdmin();
  if (!sessione.ok) return fallimento(sessione.reason);
  const utenteId = text(formData.get("utenteId"));
  if (!utenteId) return fallimento("invalid");

  if (!sessione.supabase) {
    if (!verificaCategoriaDemo(utenteId)) {
      return fallimento("giocatoreNonTrovato");
    }
    return successo("Categoria segnata come verificata.");
  }
  if (!isUuid(utenteId)) return fallimento("giocatoreNonTrovato");
  try {
    const { error } = await sessione.supabase.rpc("admin_verifica_categoria", {
      p_utente: utenteId,
    });
    if (error) return fallimento(erroreCambio(error));
    return successo("Categoria segnata come verificata.");
  } catch (error) {
    console.error("[giocatori] verifica non riuscita", error);
    return fallimento("network");
  }
}
