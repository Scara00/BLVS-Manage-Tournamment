import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "@/lib/api/responses";
import { now } from "@/lib/time/server-time";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import {
  creaDemoMieIscrizioni,
  DEMO_GIOCATORE_COOKIE,
} from "./tappa-dettaglio";

/**
 * e2e fixture of w-mie-iscrizioni: the browser's demo player (cookie, set
 * here when missing) is registered to two fresh stages, one still
 * cancellable and one past its cancel deadline. Answers their ids.
 */
export async function creaDemoMieIscrizioniRoute(): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const store = await cookies();
  let giocatore = store.get(DEMO_GIOCATORE_COOKIE)?.value;
  if (!giocatore) {
    giocatore = randomUUID();
    store.set(DEMO_GIOCATORE_COOKIE, giocatore, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return Response.json(creaDemoMieIscrizioni(giocatore, now()), {
    status: 201,
  });
}
