import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria, StatoIscrizione } from "@/lib/db/types";
import { demoIscrittiTappa } from "@/lib/demo/iscritti-admin";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { toIscrittiTappaView } from "./format";
import type {
  IscrittiTappaView,
  IscrittoRow,
  TabelloneIscrittiRow,
  TappaIscrittiRow,
} from "./types";

export type IscrittiLettura =
  { status: "ok"; tappa: IscrittiTappaView } | { status: "sessionExpired" };

type IscrizioneDb = {
  id: string;
  posto: number | null;
  stato: StatoIscrizione;
  created_at: string;
  tabellone_id: string;
  utenti: { nome: string; cognome: string; email: string } | null;
};

async function readFromDb(
  supabase: SupabaseClient,
  id: string,
): Promise<{
  tappa: TappaIscrittiRow;
  tabelloni: TabelloneIscrittiRow[];
  rows: IscrittoRow[];
} | null> {
  const { data, error } = await supabase
    .from("tappe")
    .select(
      "id, nome, data_inizio, data_fine, stato, tabelloni (id, categoria, posti)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!data) return null;
  const { tabelloni, ...tappa } = data as unknown as TappaIscrittiRow & {
    tabelloni: { id: string; categoria: Categoria; posti: number }[];
  };

  const { data: iscrizioni, error: iscrizioniError } = await supabase
    .from("iscrizioni")
    .select(
      "id, posto, stato, created_at, tabellone_id, utenti (nome, cognome, email)",
    )
    .eq("tappa_id", id)
    .in("stato", ["in_attesa", "confermata"]);
  if (iscrizioniError) throw new Error(`iscritti: ${iscrizioniError.message}`);

  const categoria = new Map(tabelloni.map((t) => [t.id, t.categoria]));
  const rows = (iscrizioni as unknown as IscrizioneDb[]).flatMap((i) => {
    const cat = categoria.get(i.tabellone_id);
    if (!cat || !i.utenti) return [];
    return [
      {
        id: i.id,
        posto: i.posto,
        stato: i.stato,
        created_at: i.created_at,
        categoria: cat,
        nome: i.utenti.nome,
        cognome: i.utenti.cognome,
        email: i.utenti.email,
      },
    ];
  });
  return {
    tappa,
    tabelloni: tabelloni.map((t) => ({
      categoria: t.categoria,
      posti: t.posti,
    })),
    rows,
  };
}

/**
 * w-admin-iscritti: the active registrants of a stage per board, read
 * through RLS with the admin's session (a player gets 403, an unknown id
 * 404). Without Supabase env it reads the in-memory demo stages.
 */
export async function readIscrittiTappa(id: string): Promise<IscrittiLettura> {
  await connection();
  if (!readSupabaseEnv()) {
    const demo = demoIscrittiTappa(id);
    if (!demo) notFound();
    return {
      status: "ok",
      tappa: toIscrittiTappaView(demo.tappa, demo.tabelloni, demo.rows),
    };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "sessionExpired" };
  if (user.ruolo !== "admin") forbidden();
  if (!isUuid(id)) notFound();
  const lettura = await readFromDb(user.supabase, id);
  if (!lettura) notFound();
  return {
    status: "ok",
    tappa: toIscrittiTappaView(lettura.tappa, lettura.tabelloni, lettura.rows),
  };
}
