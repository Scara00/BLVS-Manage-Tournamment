// @vitest-environment node
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/session";

vi.mock("server-only", () => ({}));
const { getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));

const { GET, POST } = await import("./route");

const NOW = new Date("2026-10-27T10:00:00Z").getTime();
const URL = "https://blvs.example/api/admin/sessione";

describe("/api/admin/sessione", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    getCurrentUser.mockResolvedValue({
      id: "a1",
      email: "admin@example.it",
      ruolo: "admin",
      supabase: {} as CurrentUser["supabase"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    getCurrentUser.mockReset();
  });

  it("GET dice quanto manca, senza spostare la scadenza", async () => {
    const res = (await GET(
      new NextRequest(URL, {
        headers: { cookie: `blvs_admin_scadenza=${NOW + 90_500}` },
      }),
      undefined,
    )) as NextResponse;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      scadeTraSecondi: 91,
      scadeAlle: new Date(NOW + 90_500).toISOString(),
    });
    expect(res.cookies.get("blvs_admin_scadenza")).toBeUndefined();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("GET senza cookie conta 30 minuti (il proxy l'ha appena fissata)", async () => {
    const res = await GET(new NextRequest(URL), undefined);
    expect((await res.json()).scadeTraSecondi).toBe(1800);
  });

  it("POST prolunga di 30 minuti e riscrive il cookie", async () => {
    const res = (await POST(
      new NextRequest(URL, { method: "POST" }),
      undefined,
    )) as NextResponse;
    expect(await res.json()).toEqual({
      scadeTraSecondi: 1800,
      scadeAlle: "2026-10-27T10:30:00.000Z",
    });
    const cookie = res.cookies.get("blvs_admin_scadenza");
    expect(cookie?.value).toBe(String(NOW + 1_800_000));
    expect(cookie?.httpOnly).toBe(true);
  });

  it("un giocatore riceve 403", async () => {
    getCurrentUser.mockResolvedValue({
      id: "g1",
      email: "g@example.it",
      ruolo: "giocatore",
      supabase: {} as CurrentUser["supabase"],
    });
    const res = await POST(new NextRequest(URL, { method: "POST" }), undefined);
    expect(res.status).toBe(403);
  });
});
