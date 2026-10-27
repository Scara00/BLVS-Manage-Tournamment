import { describe, expect, it } from "vitest";
import {
  describeReturnPath,
  loginHref,
  requiresSession,
  safeAfterLoginPath,
  sessionExpiredHref,
} from "./auth-paths";

describe("requiresSession", () => {
  it.each(["/", "/classifica", "/gironi/a", "/admin", "/admin/tappe"])(
    "%s richiede l'accesso",
    (path) => expect(requiresSession(path)).toBe(true),
  );

  it.each([
    "/accesso",
    "/sessione-scaduta",
    "/privacy",
    "/anteprima/503",
    "/admin/anteprima/403",
    "/api/live/stream",
    "/api/admin/tappe",
  ])("%s è pubblica (o protetta dalla route)", (path) =>
    expect(requiresSession(path)).toBe(false),
  );
});

describe("safeAfterLoginPath (redirect di ritorno)", () => {
  it.each([
    ["/classifica", "/classifica"],
    ["/admin/tappe?stato=aperte#lista", "/admin/tappe?stato=aperte#lista"],
  ])("torna al percorso interno %s", (raw, expected) => {
    expect(safeAfterLoginPath(raw)).toBe(expected);
  });

  it.each([
    "https://evil.example/classifica",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/accesso",
    "/accesso?da=/classifica",
    "/sessione-scaduta?da=/admin",
    "/privacy",
    null,
    undefined,
    ["/classifica", "/live"],
  ])("rifiuta %j e va alla home", (raw) => {
    expect(safeAfterLoginPath(raw)).toBe("/");
  });
});

describe("link di accesso", () => {
  it("porta la pagina di partenza e il motivo", () => {
    expect(loginHref("/admin/tappe?x=1", { reason: "scaduta" })).toBe(
      "/accesso?da=%2Fadmin%2Ftappe%3Fx%3D1&motivo=scaduta",
    );
    expect(loginHref(null, { signedOut: true })).toBe("/accesso?uscita=1");
    expect(loginHref("//evil.example")).toBe("/accesso");
  });

  it("la pagina di sessione scaduta ricorda da dove si veniva", () => {
    expect(sessionExpiredHref("/live")).toBe("/sessione-scaduta?da=%2Flive");
    expect(sessionExpiredHref("https://evil.example")).toBe(
      "/sessione-scaduta",
    );
  });
});

describe("describeReturnPath", () => {
  it.each([
    ["/classifica", "Classifica"],
    ["/", "Home"],
    ["/admin", "Admin · Dashboard"],
    ["/admin/tappe", "Admin · Tappe"],
    ["/admin/tappe/42", "una pagina di Admin · Tappe"],
    ["/gironi/a", "la pagina che stavi consultando"],
  ])("%s → %s", (path, label) => {
    expect(describeReturnPath(path)).toBe(label);
  });
});
