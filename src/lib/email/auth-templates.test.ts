// @vitest-environment node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SUPABASE_AUTH_TEMPLATES } from "./auth-templates";

const SUPABASE_DIR = path.resolve(process.cwd(), "supabase");
const UPDATE = process.env.UPDATE_EMAIL_TEMPLATES === "1";

/** `[auth.email.template.<key>]` table of config.toml, as key → value. */
function readTemplateConfig(key: string) {
  const config = readFileSync(path.join(SUPABASE_DIR, "config.toml"), "utf8");
  const section = config
    .split(/^\[/m)
    .find((s) => s.startsWith(`auth.email.template.${key}]`));
  const entries = [...(section ?? "").matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm)];
  return Object.fromEntries(entries.map((m) => [m[1], m[2]]));
}

describe.each(SUPABASE_AUTH_TEMPLATES)(
  "modello Supabase Auth $key",
  ({ key, file, href, render }) => {
    it(`supabase/templates/${file} è allineato al componente React Email`, async () => {
      const { html } = await render();
      const target = path.join(SUPABASE_DIR, "templates", file);
      if (UPDATE) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, html);
      }
      expect(readFileSync(target, "utf8")).toBe(html);
      expect(html).toMatch(/<html[^>]*\slang="it"/);
      expect(html).toContain(`href="${href}"`);
    });

    it("config.toml lo usa con l'oggetto in italiano", async () => {
      const { subject } = await render();
      expect(readTemplateConfig(key)).toEqual({
        subject,
        content_path: `./supabase/templates/${file}`,
      });
    });
  },
);
