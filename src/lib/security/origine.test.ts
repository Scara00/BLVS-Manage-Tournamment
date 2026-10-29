// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  ORIGINE_NON_CONSENTITA_MESSAGE,
  rifiutaApiDaAltraOrigine,
} from "./origine";

function richiesta(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest(url, {
    method: init.method ?? "POST",
    headers: { host: new URL(url).host, ...init.headers },
  });
}

describe("rifiutaApiDaAltraOrigine", () => {
  it("lascia passare le chiamate dalle pagine dell'app", () => {
    expect(
      rifiutaApiDaAltraOrigine(
        richiesta("https://blvs.example/api/iscrizioni", {
          headers: { origin: "https://blvs.example" },
        }),
      ),
    ).toBeNull();
  });

  it("dietro un proxy confronta l'host inoltrato", () => {
    expect(
      rifiutaApiDaAltraOrigine(
        richiesta("http://interno:3000/api/iscrizioni", {
          headers: {
            origin: "https://blvs.example",
            "x-forwarded-host": "blvs.example",
          },
        }),
      ),
    ).toBeNull();
  });

  it.each([
    ["un altro sito", { origin: "https://evil.example" }],
    ["un sottodominio", { origin: "https://x.blvs.example" }],
    ["Origin null", { origin: "null" }],
    ["senza Origin ma cross-site", { "sec-fetch-site": "cross-site" }],
    ["senza Origin ma same-site", { "sec-fetch-site": "same-site" }],
  ])("rifiuta una richiesta da %s con 403", async (_caso, headers) => {
    const res = rifiutaApiDaAltraOrigine(
      richiesta("https://blvs.example/api/auth/login", { headers }),
    );
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({
      error: ORIGINE_NON_CONSENTITA_MESSAGE,
    });
  });

  it("lascia passare cron e script, che non mandano Origin", () => {
    expect(
      rifiutaApiDaAltraOrigine(
        richiesta("https://blvs.example/api/admin/tappe", {
          headers: { authorization: "Bearer x" },
        }),
      ),
    ).toBeNull();
  });

  it("non tocca letture e pagine", () => {
    const daFuori = { origin: "https://evil.example" };
    expect(
      rifiutaApiDaAltraOrigine(
        richiesta("https://blvs.example/api/live/snapshot", {
          method: "GET",
          headers: daFuori,
        }),
      ),
    ).toBeNull();
    // Server Actions (POST to a page) have Next's own origin check.
    expect(
      rifiutaApiDaAltraOrigine(
        richiesta("https://blvs.example/accesso", { headers: daFuori }),
      ),
    ).toBeNull();
  });
});
