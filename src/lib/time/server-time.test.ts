import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatServerTime,
  getServerTimeParts,
  getUtcOffsetMinutes,
  now,
  SERVER_TIME_ZONE,
} from "./server-time";

const at = (iso: string) => new Date(iso);
const clock = (d: Date) => {
  const { hour, minute, second } = getServerTimeParts(d);
  return [hour, minute, second]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};

describe("orario del server", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("usa il fuso Europe/Rome", () => {
    expect(SERVER_TIME_ZONE).toBe("Europe/Rome");
  });

  it("now() segue l'orologio controllato dai test", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-07-01T10:00:00Z"));
    expect(now().toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(getServerTimeParts()).toMatchObject({
      hour: 12,
      offsetMinutes: 120,
    });
  });

  it("in inverno è UTC+1 e in estate UTC+2", () => {
    expect(getUtcOffsetMinutes(at("2026-01-15T12:00:00Z"))).toBe(60);
    expect(getUtcOffsetMinutes(at("2026-07-15T12:00:00Z"))).toBe(120);
  });

  it("passaggio all'ora legale: dalle 01:59:59 si salta alle 03:00:00", () => {
    const before = at("2026-03-29T00:59:59Z");
    const after = at("2026-03-29T01:00:00Z");
    expect(clock(before)).toBe("01:59:59");
    expect(getUtcOffsetMinutes(before)).toBe(60);
    expect(clock(after)).toBe("03:00:00");
    expect(getUtcOffsetMinutes(after)).toBe(120);
    expect(getServerTimeParts(after)).toMatchObject({
      year: 2026,
      month: 3,
      day: 29,
    });
  });

  it("ritorno all'ora solare: le 02:00–02:59 si ripetono", () => {
    const lastSummer = at("2026-10-25T00:59:59Z");
    const firstWinter = at("2026-10-25T01:00:00Z");
    expect(clock(lastSummer)).toBe("02:59:59");
    expect(getUtcOffsetMinutes(lastSummer)).toBe(120);
    expect(clock(firstWinter)).toBe("02:00:00");
    expect(getUtcOffsetMinutes(firstWinter)).toBe(60);
  });

  it("gestisce il cambio di giorno a mezzanotte di Roma", () => {
    expect(getServerTimeParts(at("2026-12-31T23:30:00Z"))).toMatchObject({
      year: 2027,
      month: 1,
      day: 1,
      hour: 0,
      minute: 30,
    });
  });

  it("formatta in italiano nel fuso di Roma", () => {
    expect(formatServerTime(at("2026-03-29T01:00:00Z"))).toBe(
      "29/03/26, 03:00:00",
    );
  });
});
