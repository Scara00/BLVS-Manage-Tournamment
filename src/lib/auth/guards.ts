import "server-only";
import type { NextRequest } from "next/server";
import { forbidden } from "@/lib/api/responses";
import { getCurrentUser, type CurrentUser } from "./session";

export type AdminUser = CurrentUser & { ruolo: "admin" };

/** Marks a handler wrapped by `withAdmin`, so tests can find unguarded routes. */
export const ADMIN_GUARD = Symbol.for("blvs.adminGuard");

type Handler<Ctx> = (request: NextRequest, context: Ctx) => Promise<Response>;

/**
 * Authorization middleware for admin Route Handlers. It verifies the session
 * and the admin role on the server for every request, and answers 403 in
 * every other case (anonymous, player, unreadable profile, no Supabase).
 */
export function withAdmin<Ctx = unknown>(
  handler: (
    request: NextRequest,
    context: Ctx,
    user: AdminUser,
  ) => Promise<Response>,
): Handler<Ctx> {
  const guarded: Handler<Ctx> = async (request, context) => {
    let user: CurrentUser | null;
    try {
      user = await getCurrentUser();
    } catch (error) {
      console.error("[auth] verifica della sessione non riuscita", error);
      user = null;
    }
    if (user?.ruolo !== "admin") return forbidden();
    return handler(request, context, user as AdminUser);
  };
  Object.defineProperty(guarded, ADMIN_GUARD, { value: true });
  return guarded;
}

export function isAdminGuarded(value: unknown): boolean {
  return (
    typeof value === "function" &&
    (value as unknown as Record<symbol, unknown>)[ADMIN_GUARD] === true
  );
}
