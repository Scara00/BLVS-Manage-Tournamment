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
  posti: ["posti", M.posti],
  posti_dispari: ["posti", M.postiDispari],
};

/**
 * Creates a stage in draft through the `crea_tappa` RPC (classic: boards M
 * and F) or `crea_tappa_mista` (one mixed board), as the signed-in admin
 * (RLS applies). Without Supabase env (CI, e2e) it still validates, then
 * answers `unavailable`.
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

  const v = result.values;
  const comuni = {
    p_nome: v.nome,
    p_luogo: v.luogo,
    p_data: v.data,
    p_scadenza: v.scadenza,
  };
  const { data: id, error } =
    v.formato === "misto"
      ? await user.supabase.rpc("crea_tappa_mista", {
          ...comuni,
          p_posti: v.posti,
        })
      : await user.supabase.rpc("crea_tappa", {
          ...comuni,
          p_posti_m: v.postiM,
          p_posti_f: v.postiF,
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
