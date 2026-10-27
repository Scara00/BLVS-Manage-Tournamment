"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { readSupabaseEnv } from "@/lib/supabase/env";
import {
  NUOVA_TAPPA_MESSAGES as M,
  TAPPA_CREATA_HREF,
  type CampoNuovaTappa,
  type NuovaTappaFormState,
} from "./types";
import { validaNuovaTappa } from "./validation";

/** `hint` raised by `public.crea_tappa()` → field and message. */
const RPC_HINTS: Record<string, [CampoNuovaTappa, string]> = {
  data_passata: ["data", M.dataPassata],
  scadenza_passata: ["scadenza", M.scadenzaPassata],
  scadenza_dopo_tappa: ["scadenza", M.scadenzaDopoTappa],
};

/**
 * Creates a stage in draft with its two boards (M and F) through the
 * `crea_tappa` RPC, as the signed-in admin (RLS applies). Without Supabase
 * env (CI, e2e) it still validates, then answers `unavailable`.
 */
export async function creaTappa(
  _prevState: NuovaTappaFormState,
  formData: FormData,
): Promise<NuovaTappaFormState> {
  const env = readSupabaseEnv();
  let user: CurrentUser | null = null;
  if (env) {
    try {
      user = await getCurrentUser();
    } catch (error) {
      console.error("[tappe] verifica della sessione non riuscita", error);
    }
    if (!user) return { status: "sessionExpired", message: M.sessionExpired };
    if (user.ruolo !== "admin") {
      return { status: "permissionDenied", message: M.permissionDenied };
    }
  }

  const result = validaNuovaTappa(formData);
  if (!result.ok) {
    return { status: "error", message: M.invalid, fields: result.fields };
  }
  if (!user) return { status: "unavailable", message: M.unavailable };

  const { nome, luogo, data, scadenza, postiM, postiF } = result.values;
  const { data: id, error } = await user.supabase.rpc("crea_tappa", {
    p_nome: nome,
    p_luogo: luogo,
    p_data: data,
    p_scadenza: scadenza,
    p_posti_m: postiM,
    p_posti_f: postiF,
  });
  if (error) {
    const campo = error.code === "23514" && RPC_HINTS[error.hint];
    if (campo) {
      return {
        status: "error",
        message: M.invalid,
        fields: { [campo[0]]: campo[1] },
      };
    }
    if (error.code === "42501") {
      return { status: "permissionDenied", message: M.permissionDenied };
    }
    console.error("[tappe] creazione non riuscita", error);
    return { status: "error", message: M.failed, fields: {} };
  }

  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message: M.created,
    id: String(id),
    href: TAPPA_CREATA_HREF,
  };
}
