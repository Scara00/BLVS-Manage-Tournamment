import { Suspense } from "react";
import { AdminClientGuard } from "@/components/admin/admin-client-guard";
import { requireAdmin } from "@/lib/auth/require-admin";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Every admin page except the error previews (`/admin/anteprima/*`, which
 * stay public) and the catch-all 404 (`[...resto]`, which must throw
 * `notFound()` outside any Suspense to prerender): the role is checked on
 * the server before anything renders (a player gets the 403 of BLVS-10),
 * then again in the browser.
 */
export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="p-inset-lg text-muted-foreground" aria-busy="true">
          Verifica dell’accesso…
        </p>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <AdminClientGuard enabled={readSupabaseEnv() !== null}>
      {children}
    </AdminClientGuard>
  );
}
