// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CONFIRMATION_LINK_TTL_SECONDS,
  EMAIL_VERIFY_CALLBACK_PATH,
  RESEND_COOLDOWN_SECONDS,
  readOutcome,
} from "./constants";
import {
  formatCountdown,
  formatExpiry,
  formatValidity,
  linkExpiresAt,
  resendWaitSeconds,
} from "./format";

vi.mock("server-only", () => ({}));
const { decodePending, encodePending } = await import("./pending");

/** `[auth.email]` of supabase/config.toml as key → raw value. */
function readAuthEmailConfig() {
  const config = readFileSync(
    path.resolve(process.cwd(), "supabase/config.toml"),
    "utf8",
  );
  const section = config.split(/^\[/m).find((s) => s.startsWith("auth.email]"));
  const entries = [...(section ?? "").matchAll(/^(\w+)\s*=\s*(.+)$/gm)];
  return Object.fromEntries(entries.map((m) => [m[1], m[2].trim()]));
}

describe("configurazione di Supabase Auth", () => {
  const config = readAuthEmailConfig();

  it("chiede la conferma dell'email prima dell'accesso", () => {
    expect(config.enable_confirmations).toBe("true");
  });

  it("la scadenza del link mostrata è quella di otp_expiry", () => {
    expect(Number(config.otp_expiry)).toBe(CONFIRMATION_LINK_TTL_SECONDS);
  });

  it("il blocco del reinvio è quello di max_frequency", () => {
    expect(config.max_frequency).toBe(`"${RESEND_COOLDOWN_SECONDS}s"`);
  });

  it("il modello di conferma punta alla nostra verifica", () => {
    const html = readFileSync(
      path.resolve(process.cwd(), "supabase/templates/conferma-email.html"),
      "utf8",
    );
    expect(html).toContain(
      `{{ .SiteURL }}${EMAIL_VERIFY_CALLBACK_PATH}?token_hash={{ .TokenHash }}&amp;type=email`,
    );
  });
});

describe("formattazione", () => {
  it("mostra la validità in cifre", () => {
    expect(formatValidity(3600)).toBe("60 minuti");
    expect(formatValidity(180 * 60)).toBe("3 ore");
    expect(formatValidity(24 * 3600)).toBe("24 ore");
    expect(formatValidity(1800)).toBe("30 minuti");
    expect(formatValidity(90 * 60)).toBe("90 minuti");
  });

  it("mostra l'ora di scadenza nel fuso di Roma", () => {
    const sent = new Date("2026-10-27T12:05:00Z");
    expect(linkExpiresAt(sent).toISOString()).toBe("2026-10-27T13:05:00.000Z");
    expect(formatExpiry(linkExpiresAt(sent))).toBe("14:05 del 27/10/2026");
  });

  it("conto alla rovescia del reinvio", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(59)).toBe("0:59");
    expect(formatCountdown(0.2)).toBe("0:01");
    expect(formatCountdown(-3)).toBe("0:00");
  });

  it("calcola l'attesa prima del prossimo invio", () => {
    const sent = new Date("2026-10-27T12:00:00Z");
    const at = (s: number) => new Date(sent.getTime() + s * 1000);
    expect(resendWaitSeconds(sent, at(0))).toBe(60);
    expect(resendWaitSeconds(sent, at(1.5))).toBe(59);
    expect(resendWaitSeconds(sent, at(59.9))).toBe(1);
    expect(resendWaitSeconds(sent, at(60))).toBe(0);
    expect(resendWaitSeconds(sent, at(-10))).toBe(60);
  });

  it("legge solo gli esiti noti", () => {
    expect(readOutcome("confermata")).toBe("confermata");
    expect(readOutcome(["scaduto"])).toBe("scaduto");
    expect(readOutcome("altro")).toBeNull();
    expect(readOutcome(undefined)).toBeNull();
  });
});

describe("cookie della registrazione in attesa", () => {
  it("conserva indirizzo e ora di invio", () => {
    const value = {
      email: "nuovo@example.it",
      inviataIl: new Date("2026-10-27T12:00:00Z"),
    };
    expect(decodePending(encodePending(value))).toEqual(value);
  });

  it("ignora valori manomessi", () => {
    expect(decodePending(undefined)).toBeNull();
    expect(decodePending("non-base64-json")).toBeNull();
    const bad = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    expect(
      decodePending(bad({ e: "senza-chiocciola", t: "2026-10-27" })),
    ).toBeNull();
    expect(decodePending(bad({ e: "a@b.it", t: "non una data" }))).toBeNull();
    expect(decodePending(bad(["a@b.it"]))).toBeNull();
  });
});
