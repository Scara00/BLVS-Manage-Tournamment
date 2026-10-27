import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import { creaDemoRigenerazione } from "./rigenera-gironi";

function intero(value: unknown, min: number, max: number): number | undefined {
  return Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
    ? (value as number)
    : undefined;
}

/**
 * Creates a demo board with scores for one e2e test; answers
 * `{ id, categoria }`. Body: `{ punteggi?: 0..12, giocatori?: 4..64 }`.
 */
export async function creaDemoRigenerazioneRoute(
  request: Request,
): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  return Response.json(
    creaDemoRigenerazione({
      punteggi: intero(body.punteggi, 0, 12),
      giocatori: intero(body.giocatori, 4, 64),
    }),
    { status: 201 },
  );
}
