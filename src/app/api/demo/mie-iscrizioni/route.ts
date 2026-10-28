import { creaDemoMieIscrizioniRoute } from "@/lib/demo/mie-iscrizioni-route";

/** POST /api/demo/mie-iscrizioni — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST() {
  return creaDemoMieIscrizioniRoute();
}
