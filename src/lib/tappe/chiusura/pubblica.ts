import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria } from "@/lib/db/types";
import { getDemoTabelloneLive } from "@/lib/demo/admin-live";
import { publishBoardClosed } from "@/lib/live/publish";
import { now } from "@/lib/time/server-time";
import { CATEGORIA_NOME } from "@/lib/tappe/avvio/paths";
import type { ClassificaTappa } from "@/lib/tappe/classifica/classifica";
import { chiaveTabellone } from "@/lib/tappe/live-admin/types";

/**
 * After «Concludi tabellone»: every live screen learns that the board's
 * points are final (`board-closed`), within the 5 s budget. A failure is
 * logged and never undoes the closing.
 */
export async function pubblicaChiusura(
  { supabase }: { supabase: SupabaseClient | null },
  {
    tappaId,
    categoria,
    tappaConclusa,
    classifica,
  }: {
    tappaId: string;
    categoria: Categoria;
    tappaConclusa: boolean;
    classifica: ClassificaTappa | null;
  },
): Promise<void> {
  try {
    const nome = supabase
      ? ((
          await supabase
            .from("tappe")
            .select("nome")
            .eq("id", tappaId)
            .maybeSingle()
        ).data?.nome as string | undefined)
      : getDemoTabelloneLive(tappaId, categoria, now())?.tappa.nome;
    publishBoardClosed({
      id: chiaveTabellone(tappaId, categoria),
      stageId: tappaId,
      category: categoria,
      label: `${nome ?? "Tappa"}, ${CATEGORIA_NOME[categoria]}`,
      closedAt: now().toISOString(),
      stageConcluded: tappaConclusa,
      points: (classifica?.righe ?? []).map((r) => ({
        playerId: r.iscrizioneId,
        name: r.nome,
        position: r.posizione,
        points: r.punti,
      })),
    });
  } catch (error) {
    console.error("[chiusura] evento live non inviato", error);
  }
}
