import { chiudiIscrizioniScadute } from "@/lib/tappe/chiusura-automatica";

/** GET /api/cron/chiudi-iscrizioni — Vercel Cron (see vercel.json). */
export async function GET(request: Request) {
  return chiudiIscrizioniScadute(request);
}
