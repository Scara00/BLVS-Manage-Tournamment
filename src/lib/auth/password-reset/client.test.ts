import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson } from "./client";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json(body, { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postJson", () => {
  it("offline: non invia nulla", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await postJson("/x", {})).toEqual({ kind: "offline" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errore di rete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    expect(await postJson("/x", {})).toEqual({ kind: "network" });
  });

  it("smista ok, campi, link non valido ed errori", async () => {
    respond(202, { messaggio: "ok" });
    expect(await postJson("/x", {})).toEqual({
      kind: "ok",
      data: { messaggio: "ok" },
    });

    respond(422, { error: "Controlla", fields: { email: "No" } });
    expect(await postJson("/x", {})).toMatchObject({
      kind: "fields",
      fields: { email: "No" },
    });

    respond(410, { error: "Scaduto", stato: "link-non-valido" });
    expect(await postJson("/x", {})).toEqual({
      kind: "link-invalid",
      message: "Scaduto",
    });

    respond(429, { error: "Troppi tentativi." });
    expect(await postJson("/x", {})).toMatchObject({
      kind: "error",
      message: "Troppi tentativi.",
    });
  });
});
