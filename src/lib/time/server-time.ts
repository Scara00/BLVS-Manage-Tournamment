/**
 * Single source of the server clock. Every part of the app that needs "now"
 * or a wall-clock time must go through this module (enforced by ESLint), so
 * the time zone is fixed in one place and tests can control the clock with
 * `vi.setSystemTime`.
 *
 * Results do not depend on the process `TZ`: Europe/Rome is applied through
 * Intl, so they are correct even on hosts that run in UTC (e.g. Vercel).
 */
export const SERVER_TIME_ZONE = "Europe/Rome";
export const SERVER_LOCALE = "it-IT";

export type ServerTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Offset from UTC in minutes: 60 in winter (CET), 120 in summer (CEST). */
  offsetMinutes: number;
};

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVER_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The current instant. The only place in the app allowed to read the clock. */
export function now(): Date {
  return new Date();
}

/** Wall-clock components of `date` in Europe/Rome. */
export function getServerTimeParts(date: Date = now()): ServerTimeParts {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(
      partsFormatter.formatToParts(date).find((p) => p.type === type)?.value,
    );
  const parts = {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return {
    ...parts,
    offsetMinutes: Math.round((asUtc - wholeSeconds) / 60_000),
  };
}

/** UTC offset of Europe/Rome at `date`, in minutes (60 or 120). */
export function getUtcOffsetMinutes(date: Date = now()): number {
  return getServerTimeParts(date).offsetMinutes;
}

/** Formats `date` in Italian, in the Europe/Rome time zone. */
export function formatServerTime(
  date: Date = now(),
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "medium",
  },
): string {
  return new Intl.DateTimeFormat(SERVER_LOCALE, {
    ...options,
    timeZone: SERVER_TIME_ZONE,
  }).format(date);
}

/** IANA time zone the Node process itself runs in (from `TZ` or the host). */
export function getProcessTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
