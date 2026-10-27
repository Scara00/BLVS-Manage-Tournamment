import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientRoleCheck } from "@/lib/auth/client-role";
import { AdminClientGuard } from "./admin-client-guard";

const replace = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/admin/tappe",
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

function renderGuard(check: () => Promise<ClientRoleCheck>, enabled = true) {
  return render(
    <AdminClientGuard enabled={enabled} check={check}>
      <p>Contenuto admin</p>
    </AdminClientGuard>,
  );
}

describe("AdminClientGuard", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("mostra la pagina finché il ruolo resta admin", async () => {
    const check = vi.fn(async (): Promise<ClientRoleCheck> => "admin");
    renderGuard(check);
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(screen.getByText("Contenuto admin")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("se il ruolo riletto non è admin mostra la 403 al posto della pagina", async () => {
    renderGuard(async () => "denied");
    expect(
      await screen.findByRole("heading", { name: "Accesso negato" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Contenuto admin")).not.toBeInTheDocument();
  });

  it("con la sessione scaduta va a «Sessione scaduta» ricordando la pagina", async () => {
    renderGuard(async () => "expired");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/sessione-scaduta?da=%2Fadmin%2Ftappe",
      ),
    );
  });

  it("se il controllo non riesce (offline) non cambia nulla", async () => {
    const check = vi.fn(async (): Promise<ClientRoleCheck> => "unknown");
    renderGuard(check);
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(screen.getByText("Contenuto admin")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("ricontrolla quando la scheda torna visibile", async () => {
    let result: ClientRoleCheck = "admin";
    const check = vi.fn(async () => result);
    renderGuard(check);
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));

    result = "denied";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(check).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("heading", { name: "Accesso negato" }),
    ).toBeInTheDocument();
  });

  it("senza Supabase non controlla nulla", () => {
    const check = vi.fn(async (): Promise<ClientRoleCheck> => "denied");
    renderGuard(check, false);
    expect(check).not.toHaveBeenCalled();
    expect(screen.getByText("Contenuto admin")).toBeInTheDocument();
  });
});
