import { describe, expect, it } from "vitest";
import { privacyHref, safeReturnPath } from "./safe-return-path";

describe("safeReturnPath", () => {
  it.each([
    ["/classifica", "/classifica"],
    ["/tappe?categoria=misto#oggi", "/tappe?categoria=misto#oggi"],
    ["/admin/iscrizioni", "/admin/iscrizioni"],
    ["/live/../classifica", "/classifica"],
  ])("accetta il percorso interno %s", (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "http://localhost/classifica",
    "//evil.example",
    "//evil.example/classifica",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "%2F%2Fevil.example",
    "classifica",
    "",
    "/privacy",
    "/privacy?da=/classifica",
  ])("rifiuta %j e torna al fallback", (raw) => {
    expect(safeReturnPath(raw)).toBe("/");
  });

  it("rifiuta valori ripetuti o assenti", () => {
    expect(safeReturnPath(["/a", "/b"])).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined, "/tappe")).toBe("/tappe");
  });
});

describe("privacyHref", () => {
  it("porta con sé il percorso di origine", () => {
    expect(privacyHref("/tappe?x=1")).toBe("/privacy?da=%2Ftappe%3Fx%3D1");
  });

  it("omette il ritorno quando l'origine non è interna", () => {
    expect(privacyHref("https://evil.example")).toBe("/privacy");
    expect(privacyHref("/privacy")).toBe("/privacy");
    expect(privacyHref(undefined)).toBe("/privacy");
  });
});
