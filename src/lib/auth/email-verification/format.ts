import { formatServerTime } from "@/lib/time/server-time";
import {
  CONFIRMATION_LINK_TTL_SECONDS,
  RESEND_COOLDOWN_SECONDS,
} from "./constants";

/**
 * «60 minuti», «24 ore»: the link validity in digits, as the email says it
 * (minutes up to two hours, then whole hours).
 */
export function formatValidity(seconds = CONFIRMATION_LINK_TTL_SECONDS) {
  const minutes = Math.round(seconds / 60);
  if (minutes <= 120 || minutes % 60 !== 0)
    return `${minutes} ${minutes === 1 ? "minuto" : "minuti"}`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "ora" : "ore"}`;
}

/** «14:05 del 27/10/2026», in Europe/Rome. */
export function formatExpiry(expiresAt: Date): string {
  const time = formatServerTime(expiresAt, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = formatServerTime(expiresAt, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${time} del ${date}`;
}

/** «0:59»: the resend countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function linkExpiresAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + CONFIRMATION_LINK_TTL_SECONDS * 1000);
}

/** Whole seconds left before another resend is allowed (0 = allowed). */
export function resendWaitSeconds(sentAt: Date, at: Date): number {
  const elapsed = (at.getTime() - sentAt.getTime()) / 1000;
  if (elapsed < 0) return RESEND_COOLDOWN_SECONDS;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}
