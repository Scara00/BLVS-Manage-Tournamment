import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_SESSION_IDLE_SECONDS,
  adminSessionIdleSeconds,
  describeCountdown,
  formatCountdown,
  isAdminArea,
  isExpired,
  nextDeadline,
  parseDeadline,
  secondsLeft,
} from "./session-timeout";

describe("scadenza della sessione admin", () => {
  it("dura 2 ore, o quanto dice ADMIN_SESSION_IDLE_SECONDS se sensato", () => {
    expect(adminSessionIdleSeconds(undefined)).toBe(2 * 60 * 60);
    expect(adminSessionIdleSeconds("600")).toBe(600);
    // Shorter than warning + 1 minute, or garbage: the default.
    expect(adminSessionIdleSeconds("100")).toBe(
      DEFAULT_ADMIN_SESSION_IDLE_SECONDS,
    );
    expect(adminSessionIdleSeconds("abc")).toBe(
      DEFAULT_ADMIN_SESSION_IDLE_SECONDS,
    );
    expect(adminSessionIdleSeconds("600.5")).toBe(
      DEFAULT_ADMIN_SESSION_IDLE_SECONDS,
    );
  });

  it("riconosce l'area admin, pagine e API", () => {
    expect(isAdminArea("/admin")).toBe(true);
    expect(isAdminArea("/admin/tappe")).toBe(true);
    expect(isAdminArea("/api/admin/sessione")).toBe(true);
    expect(isAdminArea("/administrator")).toBe(false);
    expect(isAdminArea("/tappe")).toBe(false);
  });

  it("legge il cookie solo se è un numero", () => {
    expect(parseDeadline("1761562800000")).toBe(1761562800000);
    expect(parseDeadline(undefined)).toBeNull();
    expect(parseDeadline("")).toBeNull();
    expect(parseDeadline("1e12")).toBeNull();
    expect(parseDeadline("-5")).toBeNull();
  });

  it("calcola scadenza, secondi rimasti e scaduto", () => {
    const deadline = nextDeadline(1_000, 600);
    expect(deadline).toBe(601_000);
    expect(secondsLeft(deadline, 1_000)).toBe(600);
    expect(secondsLeft(deadline, 600_001)).toBe(1);
    expect(secondsLeft(deadline, 700_000)).toBe(0);
    expect(isExpired(deadline, 600_999)).toBe(false);
    expect(isExpired(deadline, 601_000)).toBe(true);
  });

  it("scrive il conto alla rovescia in cifre e a parole", () => {
    expect(formatCountdown(120)).toBe("2:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(-3)).toBe("0:00");
    expect(describeCountdown(120)).toBe("2 minuti");
    expect(describeCountdown(61)).toBe("1 minuto e 1 secondo");
    expect(describeCountdown(45)).toBe("45 secondi");
    expect(describeCountdown(0)).toBe("0 secondi");
  });
});
