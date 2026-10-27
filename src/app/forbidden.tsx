import { ForbiddenContent } from "@/components/error-page";
import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/lib/auth/actions";

/**
 * Rendered with HTTP 403 by `forbidden()` (experimental.authInterrupts).
 * A player who reached an admin page: the player shell, not the admin one.
 * Roles are fixed until the auth layer can tell this file who is asking.
 * Route metadata is not applied here, so the board renders the `<title>`.
 */
export default function Forbidden() {
  return (
    <AppShell variant="player" signOut={signOut}>
      <ForbiddenContent
        currentRole="giocatore"
        requiredRole="admin"
        documentTitle="Accesso negato"
      />
    </AppShell>
  );
}
