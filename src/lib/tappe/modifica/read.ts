import "server-only";
import { POSTI_MISTO_MULTIPLO } from "@/lib/tappe/formato";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/validation";
import type {
  CategoriaTabellone,
  FormatoTappa,
  StatoTappa,
} from "@/lib/db/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { toRomeLocal } from "@/lib/time/rome-local";
import { demoTappaModifica } from "./demo";
import type { TabelloneModifica, TappaModifica } from "./types";

type TappaModificaRow = {
  id: string;
  nome: string;
  luogo: string;
  data_inizio: string;
  data_fine: string;
  iscrizioni_chiudono_il: string | null;
  stato: StatoTappa;
  versione: number;
  formato?: FormatoTappa;
  tabelloni: {
    id: string;
    categoria: CategoriaTabellone;
    posti: number | null;
  }[];
};

async function iscritti(supabase: SupabaseClient, tabelloneId: string) {
  const { data, error } = await supabase.rpc("iscritti_tabellone", {
    p_tabellone: tabelloneId,
  });
  if (error) throw new Error(`iscritti_tabellone: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * The floor of a mixed board's maximum: twice its fuller half, up to the
 * next multiple of 8 (the only maximums a mixed board takes).
 */
async function minimoMisto(supabase: SupabaseClient, tabelloneId: string) {
  const quote = await Promise.all(
    (["M", "F"] as const).map(async (categoria) => {
      const { data, error } = await supabase.rpc("occupati_quota", {
        p_tabellone: tabelloneId,
        p_categoria: categoria,
      });
      if (error) throw new Error(`occupati_quota: ${error.message}`);
      return Number(data ?? 0);
    }),
  );
  const doppio = 2 * Math.max(...quote);
  return Math.ceil(doppio / POSTI_MISTO_MULTIPLO) * POSTI_MISTO_MULTIPLO;
}

/**
 * The stage with its version and, per board, maximum and active
 * registrations, through RLS. `null` when it does not exist (or is hidden).
 */
export async function readTappaModificaRow(
  supabase: SupabaseClient,
  id: string,
): Promise<TappaModifica | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tappe")
    .select(
      "id, nome, luogo, data_inizio, data_fine, iscrizioni_chiudono_il, stato, versione, formato, tabelloni (id, categoria, posti)",
    )
    .eq("id", id)
    .maybeSingle<TappaModificaRow>();
  if (error) throw new Error(`tappe: ${error.message}`);
  if (!data) return null;

  const tabelloni: Partial<Record<CategoriaTabellone, TabelloneModifica>> = {};
  await Promise.all(
    data.tabelloni.map(async (t) => {
      tabelloni[t.categoria] = {
        posti: t.posti ?? 0,
        iscritti:
          t.categoria === "X"
            ? await minimoMisto(supabase, t.id)
            : await iscritti(supabase, t.id),
      };
    }),
  );

  return {
    id: data.id,
    nome: data.nome,
    luogo: data.luogo,
    data: data.data_inizio,
    dataFine: data.data_fine,
    scadenza: data.iscrizioni_chiudono_il
      ? toRomeLocal(new Date(data.iscrizioni_chiudono_il))
      : "",
    stato: data.stato,
    versione: data.versione,
    formato: data.formato ?? "classico",
    tabelloni,
  };
}

export type TappaModificaLettura =
  | { status: "ok"; tappa: TappaModifica }
  | { status: "sessionExpired" }
  | { status: "notFound" };

/**
 * What w-admin-tappa-modifica shows. Without Supabase env (CI, e2e) it
 * returns the demo stages; with it, a non-admin gets `forbidden()`.
 */
export async function readTappaModifica(
  id: string,
): Promise<TappaModificaLettura> {
  if (!readSupabaseEnv()) {
    const tappa = demoTappaModifica(id);
    return tappa ? { status: "ok", tappa } : { status: "notFound" };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "sessionExpired" };
  if (user.ruolo !== "admin") forbidden();

  const tappa = await readTappaModificaRow(user.supabase, id);
  return tappa ? { status: "ok", tappa } : { status: "notFound" };
}
