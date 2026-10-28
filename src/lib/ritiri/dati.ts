import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria } from "@/lib/db/types";
import type { AssenzaRegistrata, TipoRitiro } from "./types";

type AssenzaRow = {
  partita_id: string;
  iscrizione_id: string;
  tipo: TipoRitiro;
};

/** The absences recorded on one board (`assenze_partita`, admin RLS). */
export async function leggiAssenze(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<AssenzaRegistrata[]> {
  const { data, error } = await supabase
    .from("assenze_partita")
    .select(
      "partita_id, iscrizione_id, tipo, partite!inner(tabelloni!inner(tappa_id, categoria))",
    )
    .eq("partite.tabelloni.tappa_id", tappaId)
    .eq("partite.tabelloni.categoria", categoria);
  if (error) throw new Error(`assenze: ${error.message}`);
  return ((data ?? []) as unknown as AssenzaRow[]).map((r) => ({
    partitaId: r.partita_id,
    iscrizioneId: r.iscrizione_id,
    tipo: r.tipo,
  }));
}
