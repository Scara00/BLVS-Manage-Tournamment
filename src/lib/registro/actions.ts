"use server";

import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { parseFiltri } from "./filtri";
import { REGISTRO_MESSAGES } from "./messages";
import { leggiPaginaRegistro, paginaDemo } from "./read";
import type { CaricaPrecedentiEsito, FiltriRegistro } from "./types";

function errore(): CaricaPrecedentiEsito {
  return { status: "error", message: REGISTRO_MESSAGES.error };
}

/**
 * «Mostra le N voci precedenti»: the page before `primaDi` with the same
 * filters. Read-only; the admin role is checked here and again by the RPC.
 */
export async function caricaVociPrecedenti(
  tappaId: string,
  filtri: FiltriRegistro,
  primaDi: number,
): Promise<CaricaPrecedentiEsito> {
  if (typeof tappaId !== "string" || !Number.isSafeInteger(primaDi)) {
    return errore();
  }
  // Re-validated: a server action is a public endpoint.
  const sicuri = parseFiltri({
    tipo: filtri?.tipo ?? undefined,
    partita: filtri?.partita ?? undefined,
  });

  if (!readSupabaseEnv()) {
    const pagina = paginaDemo(tappaId, sicuri, primaDi);
    return pagina ? { status: "ok", pagina } : errore();
  }

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[registro] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) {
    return {
      status: "sessionExpired",
      message: REGISTRO_MESSAGES.sessionExpired,
    };
  }
  if (user.ruolo !== "admin" || !isUuid(tappaId)) return errore();
  try {
    const pagina = await leggiPaginaRegistro(
      user.supabase,
      tappaId,
      sicuri,
      primaDi,
    );
    return { status: "ok", pagina };
  } catch (error) {
    console.error("[registro] voci precedenti non caricate", error);
    return errore();
  }
}
