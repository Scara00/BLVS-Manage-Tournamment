import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { FASI_TABELLONE, type FaseTabellone } from "@/lib/db/types";
import { creaDemoGironi } from "./gironi-editor";
import { isDemoSeedEnabled } from "./gestione-tappe-route";

function intero(value: unknown, min: number, max: number): number | undefined {
  return Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
    ? (value as number)
    : undefined;
}

/**
 * Creates a demo board for one e2e test; answers `{ id, categoria }`.
 * Body: `{ giocatori?, gironi?, fase?: "gold"|"silver"|null, bloccata? }`.
 */
export async function creaDemoGironiRoute(request: Request): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  const fase =
    body.fase === null
      ? null
      : (FASI_TABELLONE as readonly unknown[]).includes(body.fase)
        ? (body.fase as FaseTabellone)
        : undefined;
  return Response.json(
    creaDemoGironi({
      giocatori: intero(body.giocatori, 0, 64),
      gironi: intero(body.gironi, 0, 16),
      fase,
      bloccata: body.bloccata === true,
    }),
    { status: 201 },
  );
}
