// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLiveBus } from "@/lib/live/bus";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/live/publish", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/live/publish", () => {
  it("non esiste senza LIVE_DEMO_PUBLISH", async () => {
    vi.stubEnv("LIVE_DEMO_PUBLISH", "");
    const res = await post({ type: "overall-standings", rows: [] });
    expect(res.status).toBe(404);
  });

  it("pubblica l'evento sul bus quando è abilitato", async () => {
    vi.stubEnv("LIVE_DEMO_PUBLISH", "true");
    const before = getLiveBus().snapshot().seq;
    const res = await post({ type: "overall-standings", rows: [] });
    expect(res.status).toBe(201);
    expect((await res.json()).seq).toBe(before + 1);
    expect(getLiveBus().snapshot().seq).toBe(before + 1);
  });

  it("rifiuta corpi non validi", async () => {
    vi.stubEnv("LIVE_DEMO_PUBLISH", "true");
    expect((await post("{")).status).toBe(400);
    expect((await post({ type: "boh" })).status).toBe(400);
  });
});
