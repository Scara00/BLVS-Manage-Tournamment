// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readSupabaseEnv: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/env", () => ({
  readSupabaseEnv: mocks.readSupabaseEnv,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

const { chiudiIscrizioniScadute } = await import("./chiusura-automatica");
const demo = await import("@/lib/demo/gestione-tappe");

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/chiudi-iscrizioni", {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "segreto");
  mocks.readSupabaseEnv.mockReturnValue({ url: "x", publishableKey: "y" });
  mocks.getSupabaseAdmin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: 2, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("job di chiusura automatica", () => {
  it("con il segreto di Vercel Cron chiude le iscrizioni scadute", async () => {
    const response = await chiudiIscrizioniScadute(request("Bearer segreto"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ chiuse: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("chiudi_iscrizioni_scadute");
  });

  it.each([undefined, "Bearer sbagliato", "segreto"])(
    "senza il segreto giusto (%s) risponde 401",
    async (authorization) => {
      const response = await chiudiIscrizioniScadute(request(authorization));
      expect(response.status).toBe(401);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("senza CRON_SECRET non gira (503)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await chiudiIscrizioniScadute(request("Bearer "));
    expect(response.status).toBe(503);
  });

  it("senza chiave segreta di Supabase: 503", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    const response = await chiudiIscrizioniScadute(request("Bearer segreto"));
    expect(response.status).toBe(503);
  });

  it("errore del database: 500", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    const response = await chiudiIscrizioniScadute(request("Bearer segreto"));
    expect(response.status).toBe(500);
  });

  it("senza Supabase chiude le tappe demo scadute", async () => {
    mocks.readSupabaseEnv.mockReturnValue(null);
    const id = demo.creaDemoTappa({
      stato: "iscrizioni_aperte",
      chiudonoIl: "2020-01-01T00:00:00Z",
    });
    const response = await chiudiIscrizioniScadute(request("Bearer segreto"));
    expect((await response.json()).chiuse).toBeGreaterThan(0);
    expect(demo.getDemoTappaGestione(id)?.row.chiusura_automatica).toBe(true);
  });
});
