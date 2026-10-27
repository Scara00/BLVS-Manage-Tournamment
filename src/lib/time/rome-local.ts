import { getServerTimeParts, getUtcOffsetMinutes, now } from "./server-time";

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The instant of a Europe/Rome wall-clock time, as a `datetime-local` input
 * gives it (`YYYY-MM-DDTHH:mm`). Returns `null` for a malformed value and
 * for a time that does not exist (the hour skipped when summer time starts).
 */
export function romeLocalToDate(value: string): Date | null {
  const match = LOCAL_RE.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The offset an hour earlier is right except on transition days; a
  // second pass with the candidate's own offset settles those.
  let offset = getUtcOffsetMinutes(new Date(asUtc - 3_600_000));
  let candidate = new Date(asUtc - offset * 60_000);
  const corrected = getUtcOffsetMinutes(candidate);
  if (corrected !== offset) {
    offset = corrected;
    candidate = new Date(asUtc - offset * 60_000);
  }
  const parts = getServerTimeParts(candidate);
  const same =
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute;
  return same ? candidate : null;
}

/** Midnight in Rome at the start of `day` (`YYYY-MM-DD`). */
export function romeStartOfDay(day: string): Date | null {
  return DAY_RE.test(day) ? romeLocalToDate(`${day}T00:00`) : null;
}

/** Today's date in Rome, as `YYYY-MM-DD`. */
export function romeToday(date: Date = now()): string {
  const { year, month, day } = getServerTimeParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `date` as a Rome `datetime-local` value (`YYYY-MM-DDTHH:mm`). */
export function toRomeLocal(date: Date): string {
  const { year, month, day, hour, minute } = getServerTimeParts(date);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
