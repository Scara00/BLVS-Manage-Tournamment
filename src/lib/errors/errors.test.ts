import { afterEach, describe, expect, it, vi } from "vitest";
import { errorCode } from "./error-code";
import { isErrorPreviewEnabled } from "./preview";

describe("errorCode", () => {
  it("aggiunge il digest del server quando c'è", () => {
    const error = Object.assign(new Error("x"), { digest: "123456" });
    expect(errorCode(error)).toBe("ERR-503-123456");
  });

  it("senza digest (o senza Error) resta il codice base", () => {
    expect(errorCode(new Error("x"))).toBe("ERR-503");
    expect(errorCode("boom")).toBe("ERR-503");
    expect(errorCode(null, "ERR-503-ISCR")).toBe("ERR-503-ISCR");
  });
});

describe("isErrorPreviewEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("è attivo fuori produzione o con ERROR_PREVIEWS=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isErrorPreviewEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_PREVIEWS", "true");
    expect(isErrorPreviewEnabled()).toBe(true);
    vi.stubEnv("ERROR_PREVIEWS", "");
    expect(isErrorPreviewEnabled()).toBe(false);
  });
});
