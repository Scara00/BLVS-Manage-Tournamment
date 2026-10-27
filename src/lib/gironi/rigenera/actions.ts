"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { rigeneraDemoGironi } from "@/lib/demo/rigenera-gironi";
import { readTabelloneId } from "@/lib/gironi/editor/read";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { rifiutoRigenerazione } from "./errori";
import {
  erroreConferma,
  messaggioPunteggiCambiati,
  messaggioSuccesso,
} from "./format";
import { leggiPunteggiPersi } from "./read";
import {
  RIGENERA_MESSAGES as M,
  type PunteggioPerso,
  type RigeneraState,
} from "./types";

type Richiesta = {
  tappaId: string;
  categoria: Categoria;
  conferma: boolean;
  attesi: number;
};

function leggiRichiesta(formData: FormData): Richiesta | null {
  const tappaId = formData.get("tappaId");
  const categoria = formData.get("categoria");
  const attesi = Number(formData.get("attesi"));
  if (typeof tappaId !== "string" || tappaId === "") return null;
  if (categoria !== "M" && categoria !== "F") return null;
  if (!Number.isInteger(attesi) || attesi < 0) return null;
  return {
    tappaId,
    categoria,
    conferma: formData.get("conferma") === "on",
    attesi,
  };
}

function prossimo(prev: RigeneraState): number {
  return prev.status === "idle" ? 1 : prev.at + 1;
}

function cambiati(punteggi: PunteggioPerso[], at: number): RigeneraState {
  return {
    status: "error",
    reason: "conflict",
    message: messaggioPunteggiCambiati(punteggi.length),
    punteggi,
    at,
  };
}

type Sessione =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

async function sessioneAdmin(): Promise<Sessione> {
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[gironi] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

/**
 * w-admin-rigenera-conferma: regenerates the groups of one board. With no
 * scores it runs at once; with scores the admin must tick the box, and the
 * count they saw (`attesi`) must still be the current one. The database
 * does the delete, the new draw and the `rigenerazione_gironi` log entry
 * in one transaction (RPC `rigenera_gironi`).
 */
export async function rigeneraGironi(
  prev: RigeneraState,
  formData: FormData,
): Promise<RigeneraState> {
  const at = prossimo(prev);
  const richiesta = leggiRichiesta(formData);
  if (!richiesta) {
    return { status: "error", reason: "invalid", message: M.invalid, at };
  }
  const { tappaId, categoria, conferma, attesi } = richiesta;

  // Same rule as the dialog, checked again on the server.
  if (attesi > 0 && !conferma) {
    return {
      status: "fieldErrors",
      fields: { conferma: erroreConferma(attesi) },
      at,
    };
  }

  if (!readSupabaseEnv()) {
    const esito = rigeneraDemoGironi(tappaId, categoria, { conferma, attesi });
    switch (esito.esito) {
      case "ok":
        refresh();
        return {
          status: "success",
          persi: esito.persi,
          gironi: esito.gironi,
          message: messaggioSuccesso(esito.persi, esito.gironi),
          at,
        };
      case "confermaRichiesta":
      case "cambiati":
        return cambiati(esito.punteggi, at);
      case "nonTrovato":
        return { status: "error", reason: "notFound", message: M.notFound, at };
    }
  }

  if (!isUuid(tappaId)) {
    return { status: "error", reason: "notFound", message: M.notFound, at };
  }
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return {
      status: "error",
      reason: sessione.reason,
      message: M[sessione.reason],
      at,
    };
  }
  const { supabase } = sessione;

  try {
    const tabelloneId = await readTabelloneId(supabase, tappaId, categoria);
    if (!tabelloneId) {
      return { status: "error", reason: "notFound", message: M.notFound, at };
    }
    const { data, error } = await supabase
      .rpc("rigenera_gironi", {
        p_tabellone: tabelloneId,
        p_conferma: conferma,
        p_attesi: attesi,
      })
      .single<{ gironi: number; punteggi_persi: number }>();

    if (error) {
      const rifiuto = rifiutoRigenerazione(error);
      if (rifiuto.reason === "conflict") {
        return cambiati(await leggiPunteggiPersi(supabase, tabelloneId), at);
      }
      if (rifiuto.reason === "network") {
        console.error("[gironi] rigenerazione non riuscita", error);
      }
      return { status: "error", ...rifiuto, at };
    }

    refresh();
    return {
      status: "success",
      persi: data.punteggi_persi,
      gironi: data.gironi,
      message: messaggioSuccesso(data.punteggi_persi, data.gironi),
      at,
    };
  } catch (error) {
    console.error("[gironi] rigenerazione non riuscita", error);
    return { status: "error", reason: "network", message: M.network, at };
  }
}
