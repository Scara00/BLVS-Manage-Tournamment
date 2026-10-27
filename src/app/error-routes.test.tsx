import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMatchMedia } from "@/test/media-query-mock";
import AdminCatchAll from "./admin/[...resto]/page";
import AnteprimaForbidden from "./admin/anteprima/403/page";
import Forbidden from "./forbidden";
import NotFound from "./not-found";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/pagina-che-non-esiste",
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

/** What `notFound()` / `forbidden()` throw: Next maps it to the HTTP status. */
function httpStatusOf(render: () => unknown) {
  try {
    render();
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    const match = /^NEXT_HTTP_ERROR_FALLBACK;(\d{3})$/.exec(digest);
    if (match) return Number(match[1]);
    throw error;
  }
  return 200;
}

describe("stato HTTP delle pagine di errore", () => {
  beforeEach(() => {
    // What next.config.ts `experimental.authInterrupts` sets at build time.
    vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ogni rotta admin inesistente risponde 404", () => {
    expect(httpStatusOf(() => AdminCatchAll())).toBe(404);
  });

  it("l'anteprima 403 risponde 403 in sviluppo e in e2e", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(httpStatusOf(() => AnteprimaForbidden())).toBe(403);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_PREVIEWS", "true");
    expect(httpStatusOf(() => AnteprimaForbidden())).toBe(403);
  });

  it("in produzione l'anteprima 403 non esiste (404)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_PREVIEWS", "");
    expect(httpStatusOf(() => AnteprimaForbidden())).toBe(404);
  });
});

describe("pagine di errore nella shell del giocatore", () => {
  beforeEach(() => {
    installMatchMedia(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("404: h1 testuale nel main, link alle tappe", () => {
    render(<NotFound />);
    const main = screen.getByRole("main");
    expect(main).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Pagina non trovata" }),
    );
    expect(
      screen.getByRole("link", { name: "Vai al contenuto" }),
    ).toHaveAttribute("href", "#contenuto");
    expect(
      screen.getAllByRole("link", { name: "Vai alle tappe" })[0],
    ).toHaveAttribute("href", "/tappe");
  });

  it("403: mini tabellone dei ruoli e titolo del documento", () => {
    render(<Forbidden />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Accesso negato" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ruoli")).toHaveTextContent(
      "Il tuo ruoloGiocatoreRichiestoAdmin",
    );
    expect(document.title).toBe("Accesso negato · BLVS");
  });
});
