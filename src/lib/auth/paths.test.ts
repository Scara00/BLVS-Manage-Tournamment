import { describe, expect, it } from "vitest";
import { loginHref, signupHref, signupReturnPath } from "./paths";

describe("percorsi di registrazione", () => {
  it("torna alla pagina di origine solo se interna", () => {
    expect(signupReturnPath("/tappe/1?x=1")).toBe("/tappe/1?x=1");
    expect(signupReturnPath("https://evil.example")).toBe("/");
    expect(signupReturnPath(null)).toBe("/");
  });

  it("non riporta mai alla registrazione o all'accesso", () => {
    expect(signupReturnPath("/registrati")).toBe("/");
    expect(signupReturnPath("/accesso?da=/tappe")).toBe("/");
  });

  it("costruisce i link con ?da= solo quando serve", () => {
    expect(signupHref()).toBe("/registrati");
    expect(signupHref("/live")).toBe("/registrati?da=%2Flive");
    expect(loginHref("/tappe")).toBe("/accesso?da=%2Ftappe");
    expect(loginHref("//evil.example")).toBe("/accesso");
  });
});
