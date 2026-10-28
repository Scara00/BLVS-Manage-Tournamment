import { PaletteComandi } from "@/components/admin-palette";
import { AdminSessionWatcher } from "@/components/admin-session";
import { CodaPunteggiProvider } from "@/components/coda-punteggi";
import { AppShell } from "@/components/layout/app-shell";
import {
  ADMIN_SESSION_WARNING_SECONDS,
  adminSessionIdleSeconds,
} from "@/lib/admin/session-timeout";
import { cercaPalette } from "@/lib/admin/palette/actions";
import { signOut } from "@/lib/auth/actions";
import { readSupabaseEnv } from "@/lib/supabase/env";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const enforced = readSupabaseEnv() !== null;
  return (
    <AppShell
      variant="admin"
      signOut={signOut}
      // BLVS-55: Ctrl/Cmd+K, or «Cerca» on touch, on every admin page.
      topbarActions={<PaletteComandi cerca={cercaPalette} />}
    >
      {/* BLVS-33: scores wait on the device until they reach the server. */}
      <CodaPunteggiProvider enforced={enforced}>
        {children}
      </CodaPunteggiProvider>
      {/* BLVS-18: warning before the admin session closes. */}
      <AdminSessionWatcher
        enforced={enforced}
        idleSeconds={adminSessionIdleSeconds()}
        warningSeconds={ADMIN_SESSION_WARNING_SECONDS}
        signOut={signOut}
      />
    </AppShell>
  );
}
