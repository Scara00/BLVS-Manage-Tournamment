// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RECOVERY_LINK } from "@/lib/email/auth-templates";
import { MIN_PASSWORD_LENGTH } from "../messages";
import {
  RESEND_COOLDOWN_SECONDS,
  RESET_LINK_VALIDITY_MINUTES,
} from "./messages";

const config = readFileSync(
  path.resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
);

/** Value of `key` inside the `[section]` table of config.toml. */
function setting(section: string, key: string): string | undefined {
  const table = config.split(/^\[/m).find((s) => s.startsWith(`${section}]`));
  return table?.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, "m"))?.[1];
}

describe("Supabase Auth è configurato come il flusso di reimpostazione", () => {
  it("il token monouso scade dopo 60 minuti", () => {
    expect(Number(setting("auth.email", "otp_expiry"))).toBe(
      RESET_LINK_VALIDITY_MINUTES * 60,
    );
  });

  it("«Invia di nuovo» e Supabase aspettano gli stessi 60 secondi", () => {
    expect(setting("auth.email", "max_frequency")).toBe(
      `${RESEND_COOLDOWN_SECONDS}s`,
    );
  });

  it("Supabase applica gli stessi requisiti della password", () => {
    expect(Number(setting("auth", "minimum_password_length"))).toBe(
      MIN_PASSWORD_LENGTH,
    );
    expect(setting("auth", "password_requirements")).toBe("letters_digits");
  });

  it("il link dell'email apre la nostra pagina con l'hash del token", () => {
    expect(RECOVERY_LINK).toBe(
      "{{ .SiteURL }}/reimposta-password?token_hash={{ .TokenHash }}",
    );
    const html = readFileSync(
      path.resolve(process.cwd(), "supabase/templates/reimposta-password.html"),
      "utf8",
    );
    expect(html).toContain(`href="${RECOVERY_LINK}"`);
    expect(html).not.toContain("{{ .ConfirmationURL }}");
  });
});
