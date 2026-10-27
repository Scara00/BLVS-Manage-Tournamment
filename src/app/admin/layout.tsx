import { AdminSessionWatcher } from "@/components/admin-session";
import { AppShell } from "@/components/layout/app-shell";
import {
  ADMIN_SESSION_WARNING_SECONDS,
  adminSessionIdleSeconds,
} from "@/lib/admin/session-timeout";
import { signOut } from "@/lib/auth/actions";
import { readSupabaseEnv } from "@/lib/supabase/env";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell variant="admin" signOut={signOut}>
      {children}
      {/* BLVS-18: warning before the admin session closes. */}
      <AdminSessionWatcher
        enforced={readSupabaseEnv() !== null}
        idleSeconds={adminSessionIdleSeconds()}
        warningSeconds={ADMIN_SESSION_WARNING_SECONDS}
        signOut={signOut}
      />
    </AppShell>
  );
}
