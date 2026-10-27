import type { Metadata } from "next";
import { NotFoundContent } from "@/components/error-page";
import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Pagina non trovata" };

/**
 * Every unmatched URL (HTTP 404) and every `notFound()` outside /admin.
 * It renders in the root layout only, so it brings the player shell itself.
 */
export default function NotFound() {
  return (
    <AppShell variant="player" signOut={signOut}>
      <NotFoundContent />
    </AppShell>
  );
}
