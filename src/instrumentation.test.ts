// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const getProcessTimeZone = vi.fn();
vi.mock("@/lib/time/server-time", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/time/server-time")>()),
  getProcessTimeZone,
}));

const { register } = await import("./instrumentation");

describe("avvio del server (instrumentation)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("si avvia sul fuso Europe/Rome senza avvisi", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    getProcessTimeZone.mockReturnValue("Europe/Rome");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(() => register()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Europe/Rome"));
  });

  it("avvisa, senza bloccare l'avvio, se il processo è su un altro fuso", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    getProcessTimeZone.mockReturnValue("UTC");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    expect(() => register()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("UTC"));
  });

  it("non fa nulla nel runtime edge", () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    register();
    expect(info).not.toHaveBeenCalled();
  });
});
