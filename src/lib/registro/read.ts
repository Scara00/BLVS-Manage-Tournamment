import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import { demoRegistroTappa } from "@/lib/demo/registro";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { romeToday } from "@/lib/time/rome-local";
import { formatServerTime, now } from "@/lib/time/server-time";
import { toPagina, toPartiteFiltro } from "./format";
import { VOCI_PER_PAGINA } from "./messages";
import type {
  FiltriRegistro,
  PaginaRegistro,
  PartitaFiltroDb,
  RegistroTappaView,
  VoceRegistroDb,
} from "./types";

export type RegistroLettura =
  { status: "ok"; registro: RegistroTappaView } | { status: "sessionExpired" };

/** One page of `registro_tappa()`, from the newest or before `primaDi`. */
export async function leggiPaginaRegistro(
  supabase: SupabaseClient,
  tappaId: string,
  filtri: FiltriRegistro,
  primaDi: number | null,
): Promise<PaginaRegistro> {
  const { data, error } = await supabase.rpc("registro_tappa", {
    p_tappa: tappaId,
    p_tipo: filtri.tipo,
    p_partita: filtri.partita,
    p_prima_di: primaDi,
    p_limite: VOCI_PER_PAGINA,
  });
  if (error) throw new Error(`registro: ${error.message}`);
  return toPagina((data ?? []) as VoceRegistroDb[]);
}

/** A page of the demo log, as the RPC would return it. */
export function paginaDemo(
  tappaId: string,
  filtri: FiltriRegistro,
  primaDi: number | null,
): PaginaRegistro | null {
  const demo = demoRegistroTappa(tappaId, filtri, primaDi, VOCI_PER_PAGINA);
  return demo ? toPagina(demo.rows) : null;
}

function vista(
  tappa: { id: string; nome: string },
  filtri: FiltriRegistro,
  partite: PartitaFiltroDb[],
  pagina: PaginaRegistro,
): RegistroTappaView {
  const adesso = now();
  return {
    tappa,
    oggi: romeToday(adesso),
    filtri,
    partite: toPartiteFiltro(partite),
    pagina,
    lettoAlle: formatServerTime(adesso, { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * w-admin-registro: the race events of a stage, newest first, read through
 * RLS with the admin's session (a player gets 403, an unknown id 404).
 * Without Supabase env it reads the demo log.
 */
export async function readRegistroTappa(
  id: string,
  filtri: FiltriRegistro,
): Promise<RegistroLettura> {
  await connection();
  if (!readSupabaseEnv()) {
    const demo = demoRegistroTappa(id, filtri, null, VOCI_PER_PAGINA);
    if (!demo) notFound();
    return {
      status: "ok",
      registro: vista(demo.tappa, filtri, demo.partite, toPagina(demo.rows)),
    };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "sessionExpired" };
  if (user.ruolo !== "admin") forbidden();
  if (!isUuid(id)) notFound();

  const { data: tappa, error } = await user.supabase
    .from("tappe")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!tappa) notFound();

  const [pagina, partite] = await Promise.all([
    leggiPaginaRegistro(user.supabase, id, filtri, null),
    user.supabase.rpc("partite_registro_tappa", { p_tappa: id }),
  ]);
  if (partite.error) throw new Error(`partite: ${partite.error.message}`);
  return {
    status: "ok",
    registro: vista(
      tappa as { id: string; nome: string },
      filtri,
      (partite.data ?? []) as PartitaFiltroDb[],
      pagina,
    ),
  };
}
