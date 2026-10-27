"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { modificaDemoGironi } from "@/lib/demo/gironi-editor";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { MESSAGGIO_ERRORE_GIRONI, tipoErroreGironi } from "./errori";
import { readComposizione, readTabelloneId } from "./read";
import {
  GIRONI_EDITOR_MESSAGES as M,
  NON_ASSEGNATI,
  type ComposizioneGironi,
  type EsitoGironi,
  type ModificaGironiInput,
  type OperazioneGironi,
} from "./types";
import { leggiModificaGironi } from "./validation";

function idValidi(op: OperazioneGironi): boolean {
  switch (op.tipo) {
    case "sposta":
      return (
        isUuid(op.iscrizioneId) &&
        (op.verso === NON_ASSEGNATI || isUuid(op.verso))
      );
    case "scambia":
      return isUuid(op.a) && isUuid(op.b);
    case "elimina":
      return isUuid(op.gironeId);
    case "aggiungi":
      return true;
  }
}

function chiamaRpc(
  supabase: SupabaseClient,
  tabellone: string,
  versione: number,
  op: OperazioneGironi,
) {
  const base = { p_tabellone: tabellone, p_versione: versione };
  switch (op.tipo) {
    case "sposta":
      return supabase.rpc("sposta_in_girone", {
        ...base,
        p_iscrizione: op.iscrizioneId,
        p_girone: op.verso === NON_ASSEGNATI ? null : op.verso,
      });
    case "scambia":
      return supabase.rpc("scambia_in_girone", {
        ...base,
        p_a: op.a,
        p_b: op.b,
      });
    case "aggiungi":
      return supabase.rpc("aggiungi_girone", base);
    case "elimina":
      return supabase.rpc("elimina_girone", { ...base, p_girone: op.gironeId });
  }
}

function demo(input: ModificaGironiInput): EsitoGironi {
  const r = modificaDemoGironi(
    input.tappaId,
    input.categoria,
    input.versione,
    input.operazione,
  );
  switch (r.esito) {
    case "ok":
      return { status: "ok", composizione: r.composizione };
    case "conflitto":
      return {
        status: "conflict",
        message: M.conflict,
        composizione: r.composizione,
      };
    case "bloccata":
      return {
        status: "bloccata",
        message: M.bloccata,
        composizione: r.composizione,
      };
    case "nonTrovato":
      return { status: "error", message: M.notFound };
  }
}

/**
 * Saves one change of the groups editor at once (move, swap, add, delete)
 * through the RPCs of migration 20261027350000 (RLS as the admin). The
 * client sends the `versione` it shows: if the groups changed in between
 * nothing is written and it gets the current groups (`conflict`).
 * Without Supabase env it saves into the in-memory demo store.
 */
export async function modificaGironi(
  raw: ModificaGironiInput,
): Promise<EsitoGironi> {
  const input = leggiModificaGironi(raw);
  if (!input) return { status: "error", message: M.notFound };
  if (!readSupabaseEnv()) return demo(input);

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[gironi] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { status: "sessionExpired", message: M.sessionExpired };
  if (user.ruolo !== "admin") {
    return { status: "permissionDenied", message: M.permissionDenied };
  }
  const { supabase } = user;
  if (!isUuid(input.tappaId) || !idValidi(input.operazione)) {
    return { status: "error", message: M.notFound };
  }

  let tabellone: string | null;
  try {
    tabellone = await readTabelloneId(supabase, input.tappaId, input.categoria);
  } catch (error) {
    console.error("[gironi] lettura del tabellone non riuscita", error);
    return { status: "error", message: M.failed };
  }
  if (!tabellone) return { status: "error", message: M.notFound };

  const { error } = await chiamaRpc(
    supabase,
    tabellone,
    input.versione,
    input.operazione,
  );

  let composizione: ComposizioneGironi | undefined;
  try {
    composizione = await readComposizione(supabase, tabellone);
  } catch (readError) {
    console.error("[gironi] rilettura dei gironi non riuscita", readError);
  }

  if (!error) {
    return composizione
      ? { status: "ok", composizione }
      : { status: "error", message: M.failed };
  }

  const tipo = tipoErroreGironi(error);
  if (tipo !== "conflict" && tipo !== "bloccata") {
    console.error("[gironi] modifica non riuscita", error);
  }
  const message = MESSAGGIO_ERRORE_GIRONI[tipo];
  if (tipo === "permissionDenied")
    return { status: "permissionDenied", message };
  if ((tipo === "conflict" || tipo === "bloccata") && composizione) {
    return { status: tipo, message, composizione };
  }
  return { status: "error", message, composizione };
}
