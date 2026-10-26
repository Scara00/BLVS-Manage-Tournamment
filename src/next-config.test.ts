// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";

const headerKeys = async () =>
  (await nextConfig.headers!())[0].headers.map((h) => h.key);

describe("next.config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("si carica con Cache Components attivi", () => {
    expect(nextConfig.cacheComponents).toBe(true);
  });

  it("invia HSTS su tutte le route quando HTTPS è obbligatorio", async () => {
    vi.stubEnv("ENFORCE_HTTPS", "true");
    const [rule] = await nextConfig.headers!();
    expect(rule.source).toBe("/:path*");
    expect(rule.headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  });

  it("non invia HSTS in locale", async () => {
    vi.stubEnv("ENFORCE_HTTPS", "");
    expect(await headerKeys()).not.toContain("Strict-Transport-Security");
  });
});
