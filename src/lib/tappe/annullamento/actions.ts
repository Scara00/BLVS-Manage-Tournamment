"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { accodaAvvisiAnnullamento } from "./avvisi";
import {
  ANNULLAMENTO_MESSAGES,
  erroreMotivo,
  messaggioAnnullata,
  type AnnullaTappaState,
  type ArchiviaTappaState,
  type MotivoErroreAnnullamento,
} from "./state";

type PgError = { code?: string; hint?: string | null; message?: string };

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/**
 * The admin role is checked on the server for every call; RLS, the RPC and
 * the trigger `tappe_annulla_archivia` check again. Without Supabase env
 * (CI, e2e) there is nothing to save: the actions validate, then answer
 * `unavailable`.
 */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[tappe] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Maps a database error (hint of the trigger) to the reason and copy. */
function erroreDb(error: PgError): {
  reason: MotivoErroreAnnullamento;
  message: string;
  fields?: { motivo?: string };
} {
  switch (error.hint) {
    case "motivo_mancante":
      return {
        reason: "invalid",
        message: ANNULLAMENTO_MESSAGES.invalid,
        fields: { motivo: ANNULLAMENTO_MESSAGES.motivoMancante },
      };
    case "tappa_non_annullabile":
      return {
        reason: "conflict",
        message: ANNULLAMENTO_MESSAGES.nonAnnullabile,
      };
    case "tabelloni_non_conclusi":
      return {
        reason: "conflict",
        message: ANNULLAMENTO_MESSAGES.archiviaNonDisponibile,
      };
    case "tappa_annullata":
    case "tappa_archiviata":
    case "tappa_non_trovata":
      return { reason: "conflict", message: ANNULLAMENTO_MESSAGES.conflict };
  }
  if (error.code === "42501") {
    return {
      reason: "permissionDenied",
      message: ANNULLAMENTO_MESSAGES.permissionDenied,
    };
  }
  if (error.code === "23514") {
    return { reason: "invalid", message: ANNULLAMENTO_MESSAGES.invalid };
  }
  console.error("[tappe] errore del database", error);
  return { reason: "network", message: ANNULLAMENTO_MESSAGES.network };
}

/** Origin of the request, for the links in the emails. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * w-admin-annulla-tappa: cancels the stage with its reason, then queues the
 * «Tappa annullata» email for every pending or confirmed player.
 */
export async function annullaTappa(
  _prev: AnnullaTappaState,
  formData: FormData,
): Promise<AnnullaTappaState> {
  const at = now().getTime();
  const fail = (
    reason: MotivoErroreAnnullamento,
    message: string,
    fields: { motivo?: string } = {},
  ): AnnullaTappaState => ({ status: "error", reason, message, fields, at });

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fail(sessione.reason, ANNULLAMENTO_MESSAGES[sessione.reason]);
  }

  const id = text(formData.get("tappaId"));
  const motivo = text(formData.get("motivo")).trim();
  const errore = erroreMotivo(motivo);
  if (errore) {
    return fail("invalid", ANNULLAMENTO_MESSAGES.invalid, { motivo: errore });
  }
  if (!id) return fail("conflict", ANNULLAMENTO_MESSAGES.conflict);
  if (!sessione.supabase) {
    return fail("unavailable", ANNULLAMENTO_MESSAGES.unavailable);
  }
  if (!isUuid(id)) return fail("conflict", ANNULLAMENTO_MESSAGES.conflict);

  const supabase = sessione.supabase;
  let tappa: { nome: string; luogo: string; data_inizio: string } | null;
  let destinatari: { email: string }[];
  try {
    const letta = await supabase
      .from("tappe")
      .select("nome, luogo, data_inizio")
      .eq("id", id)
      .maybeSingle();
    if (letta.error) {
      const e = erroreDb(letta.error);
      return fail(e.reason, e.message, e.fields);
    }
    tappa = letta.data;
    if (!tappa) return fail("conflict", ANNULLAMENTO_MESSAGES.conflict);

    const { data, error } = await supabase.rpc("annulla_tappa", {
      p_tappa: id,
      p_motivo: motivo,
    });
    if (error) {
      const e = erroreDb(error);
      return fail(e.reason, e.message, e.fields);
    }
    destinatari = (data ?? []) as { email: string }[];
  } catch (error) {
    console.error("[tappe] annullamento non riuscito", error);
    return fail("network", ANNULLAMENTO_MESSAGES.network);
  }

  // The stage is cancelled: from here on nothing undoes it.
  let avvisi = { accodati: 0, nonAccodati: destinatari.length };
  try {
    avvisi = await accodaAvvisiAnnullamento({
      tappa: {
        id,
        nome: tappa.nome,
        luogo: tappa.luogo,
        dataInizio: tappa.data_inizio,
        motivo,
      },
      destinatari,
      origin: await requestOrigin(),
    });
  } catch (error) {
    console.error("[tappe] avvisi di annullamento non accodati", error);
  }

  refresh();
  return {
    status: "success",
    message: messaggioAnnullata(avvisi.accodati, avvisi.nonAccodati),
    avvisi: avvisi.accodati,
    nonAccodati: avvisi.nonAccodati,
    at,
  };
}

/**
 * Archives a stage: allowed only when it is cancelled or both boards are
 * concluded. The trigger is the guard; the button only mirrors it.
 */
export async function archiviaTappa(
  _prev: ArchiviaTappaState,
  formData: FormData,
): Promise<ArchiviaTappaState> {
  const at = now().getTime();
  const fail = (
    reason: MotivoErroreAnnullamento,
    message: string,
  ): ArchiviaTappaState => ({ status: "error", reason, message, at });

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fail(sessione.reason, ANNULLAMENTO_MESSAGES[sessione.reason]);
  }
  const id = text(formData.get("tappaId"));
  if (!id) return fail("conflict", ANNULLAMENTO_MESSAGES.conflict);
  if (!sessione.supabase) {
    return fail("unavailable", ANNULLAMENTO_MESSAGES.unavailable);
  }
  if (!isUuid(id)) return fail("conflict", ANNULLAMENTO_MESSAGES.conflict);

  try {
    const { data, error } = await sessione.supabase
      .from("tappe")
      .update({ stato: "archiviata" })
      .eq("id", id)
      .select("id");
    if (error) {
      const e = erroreDb(error);
      return fail(e.reason, e.message);
    }
    if (data.length === 0)
      return fail("conflict", ANNULLAMENTO_MESSAGES.conflict);
  } catch (error) {
    console.error("[tappe] archiviazione non riuscita", error);
    return fail("network", ANNULLAMENTO_MESSAGES.network);
  }
  refresh();
  return { status: "success", message: ANNULLAMENTO_MESSAGES.archiviata, at };
}
