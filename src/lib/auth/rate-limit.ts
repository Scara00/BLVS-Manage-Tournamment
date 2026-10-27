import "server-only";
import { jsonError } from "@/lib/api/responses";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { now } from "@/lib/time/server-time";

export type RateLimitHit = { allowed: boolean; resetAt: Date };

/** Counts one attempt on `key` in a fixed window of `windowSeconds`. */
export interface RateLimitStore {
  hit(key: string, max: number, windowSeconds: number): Promise<RateLimitHit>;
}

type Rule = { scope: "ip" | "email"; max: number; windowSeconds: number };

/**
 * Attempts allowed per action. Login is limited per IP and per account, so a
 * botnet cannot hammer one account and one IP cannot sweep many.
 */
export const AUTH_RATE_LIMITS = {
  login: [
    { scope: "ip", max: 20, windowSeconds: 15 * 60 },
    { scope: "email", max: 5, windowSeconds: 15 * 60 },
  ],
  register: [
    { scope: "ip", max: 5, windowSeconds: 60 * 60 },
    { scope: "email", max: 3, windowSeconds: 60 * 60 },
  ],
  // Password reset (BLVS-14): a 429 is the same for known and unknown emails.
  "reset-request": [
    { scope: "ip", max: 10, windowSeconds: 60 * 60 },
    { scope: "email", max: 5, windowSeconds: 60 * 60 },
  ],
  "reset-confirm": [{ scope: "ip", max: 20, windowSeconds: 15 * 60 }],
} as const satisfies Record<string, readonly Rule[]>;

export type AuthAction = keyof typeof AUTH_RATE_LIMITS;

/** Single-process store: dev, CI and tests (no shared state across instances). */
export function createMemoryRateLimitStore(): RateLimitStore {
  const windows = new Map<string, { start: number; attempts: number }>();
  return {
    async hit(key, max, windowSeconds) {
      const t = now().getTime();
      const windowMs = windowSeconds * 1000;
      const current = windows.get(key);
      const entry =
        current && current.start + windowMs > t
          ? { start: current.start, attempts: current.attempts + 1 }
          : { start: t, attempts: 1 };
      windows.set(key, entry);
      return {
        allowed: entry.attempts <= max,
        resetAt: new Date(entry.start + windowMs),
      };
    },
  };
}

/** Shared store in Postgres (`auth_rate_limit_hit`), callable only with the secret key. */
function createSupabaseRateLimitStore(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): RateLimitStore {
  return {
    async hit(key, max, windowSeconds) {
      const { data, error } = await admin
        .rpc("auth_rate_limit_hit", {
          p_chiave: key,
          p_max: max,
          p_finestra_secondi: windowSeconds,
        })
        .single<{ consentito: boolean; reset_il: string }>();
      if (error || !data)
        throw error ?? new Error("auth_rate_limit_hit: nessuna riga");
      return { allowed: data.consentito, resetAt: new Date(data.reset_il) };
    },
  };
}

let store: RateLimitStore | undefined;
let warnedMemoryStore = false;

function getStore(): RateLimitStore {
  if (store) return store;
  const admin = getSupabaseAdmin();
  if (admin) {
    store = createSupabaseRateLimitStore(admin);
  } else {
    if (process.env.NODE_ENV === "production" && !warnedMemoryStore) {
      warnedMemoryStore = true;
      console.warn(
        "[auth] SUPABASE_SECRET_KEY non impostata: limite ai tentativi solo in memoria, per istanza.",
      );
    }
    store = createMemoryRateLimitStore();
  }
  return store;
}

/** Test hook: swap the store (pass `undefined` to go back to the default). */
export function setRateLimitStore(next: RateLimitStore | undefined) {
  store = next;
}

/** Client IP as seen by Vercel / the TLS-terminating proxy. */
export function clientIp(request: { headers: Pick<Headers, "get"> }): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "sconosciuto";
}

export const RATE_LIMITED_MESSAGE =
  "Troppi tentativi. Riprova tra qualche minuto.";

export type AuthAttemptCheck =
  | { status: "allowed" }
  | { status: "blocked"; retryAt: Date; retryAfterSeconds: number }
  | { status: "unavailable" };

/**
 * Counts one attempt of `action` from `ip` on `email` on every rule and says
 * whether it may go on. When blocked, `retryAt` is the end of the longest
 * window exceeded. A counter error is `unavailable` (callers fail closed).
 */
export async function checkAuthAttempt(
  ip: string,
  action: AuthAction,
  email: string | null,
): Promise<AuthAttemptCheck> {
  const subjects = { ip, email: email?.trim().toLowerCase() };
  let hits: RateLimitHit[];
  try {
    hits = await Promise.all(
      AUTH_RATE_LIMITS[action]
        .filter((rule) => subjects[rule.scope])
        .map((rule) =>
          getStore().hit(
            `${action}:${rule.scope}:${subjects[rule.scope]}`,
            rule.max,
            rule.windowSeconds,
          ),
        ),
    );
  } catch (error) {
    console.error("[auth] limite ai tentativi non raggiungibile", error);
    return { status: "unavailable" };
  }

  const blocked = hits.filter((hit) => !hit.allowed);
  if (blocked.length === 0) return { status: "allowed" };

  const resetAt = Math.max(...blocked.map((hit) => hit.resetAt.getTime()));
  return {
    status: "blocked",
    retryAt: new Date(resetAt),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt - now().getTime()) / 1000),
    ),
  };
}

/**
 * Counts the attempt on every rule of `action` and returns a 429 response
 * (with `Retry-After`) when any is exceeded, `null` when the request may go on.
 * If the counter cannot be reached the request is refused (fail closed).
 */
export async function limitAuthAttempt(
  request: Request,
  action: AuthAction,
  email: string | null,
): Promise<Response | null> {
  const check = await checkAuthAttempt(clientIp(request), action, email);
  if (check.status === "allowed") return null;
  if (check.status === "unavailable")
    return jsonError(503, "Servizio momentaneamente non disponibile. Riprova.");
  return jsonError(429, RATE_LIMITED_MESSAGE, {
    headers: { "Retry-After": String(check.retryAfterSeconds) },
  });
}
