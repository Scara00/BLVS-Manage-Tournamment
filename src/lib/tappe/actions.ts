"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { STATI_TAPPA, type StatoTappa } from "@/lib/db/types";
import {
  aggiornaScadenzaDemo,
  cambiaStatoDemo,
  getDemoTappaGestione,
  type DemoEsito,
} from "@/lib/demo/gestione-tappe";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import {
  GESTIONE_MESSAGES,
  type CambioStatoState,
  type MotivoErrore,
  type ScadenzaState,
} from "./gestione-state";
import {
  COPY_TRANSIZIONE,
  isTransizionePermessa,
  tipoTransizione,
  validaScadenza,
} from "./stato";

type PgError = { code?: string; hint?: string | null; message?: string };

function stato(value: FormDataEntryValue | null): StatoTappa | null {
  return typeof value === "string" &&
    (STATI_TAPPA as readonly string[]).includes(value)
    ? (value as StatoTappa)
    : null;
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/**
 * The admin role is verified on the server for every call; the RLS policy
 * `tappe_admin` and the trigger check it again. Without Supabase env
 * (CI, e2e) the in-memory demo stages are used, as by the reads.
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

function motivoDb(error: PgError): MotivoErrore {
  if (error.code === "42501") return "permissionDenied";
  if (error.code === "23514") return "invalid";
  return "network";
}

function messaggioDb(error: PgError): string {
  if (error.hint === "scadenza_mancante") {
    return "Le iscrizioni si aprono solo con una scadenza futura: aggiorna prima la scadenza.";
  }
  switch (motivoDb(error)) {
    case "invalid":
      return GESTIONE_MESSAGES.transizione;
    case "permissionDenied":
      return GESTIONE_MESSAGES.permissionDenied;
    default:
      return GESTIONE_MESSAGES.network;
  }
}

function esitoDemo(esito: DemoEsito): {
  reason: MotivoErrore;
  message: string;
} | null {
  switch (esito) {
    case "ok":
      return null;
    case "scadenzaMancante":
      return {
        reason: "invalid",
        message:
          "Le iscrizioni si aprono solo con una scadenza futura: aggiorna prima la scadenza.",
      };
    case "transizioneNonPermessa":
      return { reason: "invalid", message: GESTIONE_MESSAGES.transizione };
    default:
      return { reason: "conflict", message: GESTIONE_MESSAGES.conflict };
  }
}

/** bozza → iscrizioni aperte, iscrizioni aperte → chiuse. */
export async function cambiaStatoTappa(
  _prev: CambioStatoState,
  formData: FormData,
): Promise<CambioStatoState> {
  const at = now();
  const fail = (reason: MotivoErrore, message: string): CambioStatoState => ({
    status: "error",
    reason,
    message,
    at: at.getTime(),
  });

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fail(sessione.reason, GESTIONE_MESSAGES[sessione.reason]);
  }

  const id = text(formData.get("tappaId"));
  const da = stato(formData.get("da"));
  const a = stato(formData.get("a"));
  if (!id || !da || !a || !isTransizionePermessa(da, a)) {
    return fail("invalid", GESTIONE_MESSAGES.transizione);
  }
  const tipo = tipoTransizione(da, a)!;
  const success: CambioStatoState = {
    status: "success",
    stato: a,
    message: COPY_TRANSIZIONE[tipo].successo,
    at: at.getTime(),
  };

  if (!sessione.supabase) {
    const problema = esitoDemo(cambiaStatoDemo(id, da, a, at));
    if (problema) return fail(problema.reason, problema.message);
    refresh();
    return success;
  }

  if (!isUuid(id)) return fail("conflict", GESTIONE_MESSAGES.conflict);
  try {
    const { data, error } = await sessione.supabase
      .from("tappe")
      .update({ stato: a })
      .eq("id", id)
      .eq("stato", da)
      .select("id");
    if (error) {
      if (motivoDb(error) === "network") {
        console.error("[tappe] cambio di stato non riuscito", error);
      }
      return fail(motivoDb(error), messaggioDb(error));
    }
    // 0 rows: someone (or the deadline job) changed it in the meantime.
    if (data.length === 0) return fail("conflict", GESTIONE_MESSAGES.conflict);
  } catch (error) {
    console.error("[tappe] cambio di stato non riuscito", error);
    return fail("network", GESTIONE_MESSAGES.network);
  }
  refresh();
  return success;
}

/** Sets `iscrizioni_chiudono_il` from a Rome `datetime-local` value. */
export async function aggiornaScadenzaTappa(
  _prev: ScadenzaState,
  formData: FormData,
): Promise<ScadenzaState> {
  const at = now();
  const fail = (
    reason: MotivoErrore,
    message: string,
    fields: { chiudonoIl?: string } = {},
  ): ScadenzaState => ({
    status: "error",
    reason,
    message,
    fields,
    at: at.getTime(),
  });

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fail(sessione.reason, GESTIONE_MESSAGES[sessione.reason]);
  }
  const id = text(formData.get("tappaId"));
  const valore = text(formData.get("chiudonoIl"));
  if (!id) return fail("conflict", GESTIONE_MESSAGES.conflict);

  let vincoli: {
    stato: StatoTappa;
    data_inizio: string;
    iscrizioni_aprono_il: string | null;
  } | null;
  try {
    if (!sessione.supabase) {
      vincoli = getDemoTappaGestione(id)?.row ?? null;
    } else if (!isUuid(id)) {
      vincoli = null;
    } else {
      const { data, error } = await sessione.supabase
        .from("tappe")
        .select("stato, data_inizio, iscrizioni_aprono_il")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      vincoli = data;
    }
  } catch (error) {
    console.error("[tappe] lettura della tappa non riuscita", error);
    return fail("network", GESTIONE_MESSAGES.network);
  }
  if (
    !vincoli ||
    (vincoli.stato !== "bozza" && vincoli.stato !== "iscrizioni_aperte")
  ) {
    return fail("conflict", GESTIONE_MESSAGES.conflict);
  }

  const esito = validaScadenza(
    valore,
    {
      dataInizio: vincoli.data_inizio,
      iscrizioniApronoIl: vincoli.iscrizioni_aprono_il
        ? new Date(vincoli.iscrizioni_aprono_il)
        : null,
    },
    at,
  );
  if (!esito.ok) {
    return fail("invalid", GESTIONE_MESSAGES.scadenzaInvalida, {
      chiudonoIl: esito.error,
    });
  }

  const success: ScadenzaState = {
    status: "success",
    message: GESTIONE_MESSAGES.scadenzaSalvata,
    at: at.getTime(),
  };

  if (!sessione.supabase) {
    const problema = esitoDemo(aggiornaScadenzaDemo(id, esito.value));
    if (problema) return fail(problema.reason, problema.message);
    refresh();
    return success;
  }

  try {
    const { data, error } = await sessione.supabase
      .from("tappe")
      .update({ iscrizioni_chiudono_il: esito.value.toISOString() })
      .eq("id", id)
      .eq("stato", vincoli.stato)
      .select("id");
    if (error) {
      if (motivoDb(error) === "network") {
        console.error("[tappe] scadenza non salvata", error);
      }
      return error.code === "23514"
        ? fail("invalid", GESTIONE_MESSAGES.scadenzaInvalida, {
            chiudonoIl:
              error.hint === "scadenza_mancante"
                ? "La scadenza deve essere nel futuro."
                : "La scadenza non rispetta i vincoli della tappa.",
          })
        : fail(motivoDb(error), messaggioDb(error));
    }
    if (data.length === 0) return fail("conflict", GESTIONE_MESSAGES.conflict);
  } catch (error) {
    console.error("[tappe] scadenza non salvata", error);
    return fail("network", GESTIONE_MESSAGES.network);
  }
  refresh();
  return success;
}
