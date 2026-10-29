/**
 * Admin idle timeout (BLVS-18). Supabase refreshes its tokens silently, so
 * the admin area keeps its own deadline: an httpOnly cookie holding the
 * epoch (ms) after which the admin session is closed. Every admin page load
 * or admin request moves it forward (see `updateSession`); the browser shows
 * a warning before it passes and can extend it with
 * `POST /api/admin/sessione`.
 */

/** Minutes of inactivity before the admin session closes. */
export const DEFAULT_ADMIN_SESSION_IDLE_SECONDS = 30 * 60;

/** The warning shows this long before the deadline. */
export const ADMIN_SESSION_WARNING_SECONDS = 120;

/** httpOnly cookie with the deadline, as epoch milliseconds. */
export const ADMIN_DEADLINE_COOKIE = "blvs_admin_scadenza";

/** Status and extension endpoint, called by the browser. */
export const ADMIN_SESSION_API_PATH = "/api/admin/sessione";

/**
 * Idle seconds, from `ADMIN_SESSION_IDLE_SECONDS` when it is a sensible
 * number (never shorter than the warning plus a minute), else 30 minutes.
 */
export function adminSessionIdleSeconds(
  raw: string | undefined = process.env.ADMIN_SESSION_IDLE_SECONDS,
): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= ADMIN_SESSION_WARNING_SECONDS + 60
    ? value
    : DEFAULT_ADMIN_SESSION_IDLE_SECONDS;
}

/** Whether `pathname` belongs to the admin area (pages or API). */
export function isAdminArea(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

/** The deadline stored in the cookie, or `null` when missing or garbled. */
export function parseDeadline(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}

/** A fresh deadline, `idleSeconds` from `nowMs`. */
export function nextDeadline(
  nowMs: number,
  idleSeconds = adminSessionIdleSeconds(),
): number {
  return nowMs + idleSeconds * 1000;
}

/** Whole seconds left before `deadline`, never negative. */
export function secondsLeft(deadline: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadline - nowMs) / 1000));
}

export function isExpired(deadline: number, nowMs: number): boolean {
  return nowMs >= deadline;
}

/** Cookie options: httpOnly, lax, secure outside local http. */
export function deadlineCookieOptions(idleSeconds = adminSessionIdleSeconds()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Outlives the deadline a little, so an expired one is still seen.
    maxAge: idleSeconds + 24 * 60 * 60,
  };
}

/**
 * Deletes the deadline cookie: at sign-in and sign-out, and when the
 * session is closed. A deadline left over from an earlier session would
 * close the next one at its first admin request.
 */
export function clearedDeadlineCookieOptions() {
  return { ...deadlineCookieOptions(), maxAge: 0 };
}

/** «1:59», «0:05»: the countdown in the warning. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** «1 minuto e 59 secondi»: the same, for screen readers. */
export function describeCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  const parts = [];
  if (minutes) parts.push(minutes === 1 ? "1 minuto" : `${minutes} minuti`);
  if (seconds || !minutes)
    parts.push(seconds === 1 ? "1 secondo" : `${seconds} secondi`);
  return parts.join(" e ");
}

/** Response body of the status/extension endpoint. */
export type AdminSessionStatus = {
  /** Seconds left: relative, so a skewed browser clock does not matter. */
  scadeTraSecondi: number;
  /** ISO time of the deadline, for «prolungata fino alle HH:MM». */
  scadeAlle: string;
};

/** Error body when the deadline has passed (proxy and route). */
export const ADMIN_SESSION_EXPIRED_MESSAGE =
  "La sessione di amministrazione è scaduta. Accedi di nuovo.";
