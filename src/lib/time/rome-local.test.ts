import { afterEach, describe, expect, it, vi } from "vitest";
import {
  romeLocalToDate,
  romeStartOfDay,
  romeToday,
  toRomeLocal,
} from "./rome-local";

afterEach(() => {
  vi.useRealTimers();
});

describe("romeLocalToDate", () => {
  it("ora solare (CET, +1)", () => {
    expect(romeLocalToDate("2027-01-15T10:30")?.toISOString()).toBe(
      "2027-01-15T09:30:00.000Z",
    );
  });

  it("ora legale (CEST, +2)", () => {
    expect(romeLocalToDate("2027-06-14T23:59")?.toISOString()).toBe(
      "2027-06-14T21:59:00.000Z",
    );
  });

  it("giorno del passaggio all'ora legale", () => {
    // 28 marzo 2027: alle 02:00 si passa alle 03:00.
    expect(romeLocalToDate("2027-03-28T01:30")?.toISOString()).toBe(
      "2027-03-28T00:30:00.000Z",
    );
    expect(romeLocalToDate("2027-03-28T03:30")?.toISOString()).toBe(
      "2027-03-28T01:30:00.000Z",
    );
    expect(romeLocalToDate("2027-03-28T02:30")).toBeNull();
  });

  it("giorno del ritorno all'ora solare", () => {
    // 31 ottobre 2027: alle 03:00 si torna alle 02:00.
    expect(romeLocalToDate("2027-10-31T01:00")?.toISOString()).toBe(
      "2027-10-30T23:00:00.000Z",
    );
    expect(romeLocalToDate("2027-10-31T12:00")?.toISOString()).toBe(
      "2027-10-31T11:00:00.000Z",
    );
    expect(romeLocalToDate("2027-10-31T02:30")).not.toBeNull();
  });

  it("rifiuta valori malformati o inesistenti", () => {
    expect(romeLocalToDate("")).toBeNull();
    expect(romeLocalToDate("2027-06-14")).toBeNull();
    expect(romeLocalToDate("2027-02-30T10:00")).toBeNull();
  });
});

describe("romeStartOfDay / romeToday / toRomeLocal", () => {
  it("mezzanotte italiana", () => {
    expect(romeStartOfDay("2027-06-14")?.toISOString()).toBe(
      "2027-06-13T22:00:00.000Z",
    );
    expect(romeStartOfDay("14/06/2027")).toBeNull();
  });

  it("oggi a Roma anche quando in UTC è ancora ieri", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-06-13T22:30:00Z"));
    expect(romeToday()).toBe("2027-06-14");
  });

  it("formatta per un campo datetime-local", () => {
    expect(toRomeLocal(new Date("2027-06-14T21:59:00Z"))).toBe(
      "2027-06-14T23:59",
    );
  });
});
