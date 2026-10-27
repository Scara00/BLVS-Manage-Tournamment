// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceHttps, isHttpsEnforced } from "./https";

const request = (url: string, proto?: string) =>
  new NextRequest(url, {
    headers: proto ? { "x-forwarded-proto": proto } : {},
  });

describe("enforceHttps", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("è disattivato senza ENFORCE_HTTPS", () => {
    vi.stubEnv("ENFORCE_HTTPS", "");
    expect(isHttpsEnforced()).toBe(false);
    expect(enforceHttps(request("http://example.com/"))).toBeNull();
  });

  describe("con ENFORCE_HTTPS=true", () => {
    it("reindirizza HTTP su HTTPS con 308 mantenendo path e querystring", () => {
      vi.stubEnv("ENFORCE_HTTPS", "true");
      const res = enforceHttps(
        request("http://example.com:8080/tornei?anno=2026"),
      );
      expect(res?.status).toBe(308);
      expect(res?.headers.get("location")).toBe(
        "https://example.com/tornei?anno=2026",
      );
    });

    it("usa lo schema originale da x-forwarded-proto", () => {
      vi.stubEnv("ENFORCE_HTTPS", "true");
      const res = enforceHttps(request("https://example.com/a", "http"));
      expect(res?.headers.get("location")).toBe("https://example.com/a");
    });

    it("rifiuta con 403 le API in HTTP invece di reindirizzarle", async () => {
      vi.stubEnv("ENFORCE_HTTPS", "true");
      for (const url of [
        "http://example.com/api",
        "http://example.com/api/auth/login",
      ]) {
        const res = enforceHttps(request(url));
        expect(res?.status).toBe(403);
        expect(res?.headers.get("location")).toBeNull();
        expect(await res?.json()).toEqual({ error: "HTTPS obbligatorio." });
      }
      // «/apiario» non è un'API.
      expect(enforceHttps(request("http://example.com/apiario"))?.status).toBe(
        308,
      );
    });

    it("non tocca le richieste già in HTTPS", () => {
      vi.stubEnv("ENFORCE_HTTPS", "true");
      expect(enforceHttps(request("https://example.com/"))).toBeNull();
      expect(enforceHttps(request("http://internal/", "https"))).toBeNull();
    });
  });
});
