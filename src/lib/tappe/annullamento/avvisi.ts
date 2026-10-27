import "server-only";
import { accodaEmail } from "@/lib/email/queue";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** A player to notify: a row of RPC `annulla_tappa()`. */
export type DestinatarioAvviso = { email: string };

export type TappaAnnullataAvviso = {
  id: string;
  nome: string;
  luogo: string;
  /** `YYYY-MM-DD`. */
  dataInizio: string;
  motivo: string;
};

/**
 * The page the email links to. TODO(BLVS-24): keep in step with the stage
 * detail route (`tappaHref()` of BLVS-23 points to the same path).
 */
export function dettaglioTappaUrl(origin: string, tappaId: string) {
  return new URL(`/tappe/${encodeURIComponent(tappaId)}`, origin).href;
}

/**
 * Queues the «Tappa annullata» email (BLVS-08 service) for every player.
 * The stage is already cancelled when this runs: a failed email is counted
 * and logged, never a reason to undo the cancellation.
 */
export async function accodaAvvisiAnnullamento({
  tappa,
  destinatari,
  origin,
}: {
  tappa: TappaAnnullataAvviso;
  destinatari: readonly DestinatarioAvviso[];
  origin: string;
}): Promise<{ accodati: number; nonAccodati: number }> {
  if (destinatari.length === 0) return { accodati: 0, nonAccodati: 0 };

  const client = getSupabaseAdmin();
  if (!client) {
    console.error(
      "[tappe] SUPABASE_SECRET_KEY mancante: avvisi di annullamento non accodati",
      tappa.id,
    );
    return { accodati: 0, nonAccodati: destinatari.length };
  }

  const props = {
    stageName: tappa.nome,
    startsAt: tappa.dataInizio,
    location: tappa.luogo,
    reason: tappa.motivo,
    detailsUrl: dettaglioTappaUrl(origin, tappa.id),
  };
  const esiti = await Promise.allSettled(
    destinatari.map((destinatario) =>
      accodaEmail(client, {
        to: destinatario.email,
        template: "tappa-annullata",
        props,
      }),
    ),
  );
  const nonAccodati = esiti.filter((e) => e.status === "rejected").length;
  if (nonAccodati > 0) {
    console.error(
      `[tappe] ${nonAccodati} avvisi di annullamento non accodati`,
      tappa.id,
    );
  }
  return { accodati: esiti.length - nonAccodati, nonAccodati };
}
