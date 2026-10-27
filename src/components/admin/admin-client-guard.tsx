"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ForbiddenContent } from "@/components/error-page";
import {
  checkAdminInBrowser,
  type ClientRoleCheck,
} from "@/lib/auth/client-role";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";

/**
 * Client half of the admin guard. The server already checked the role
 * (`requireAdmin`), so the page renders straight away; the browser then
 * re-reads session and role from Supabase on load and whenever the tab
 * comes back into view. A role taken away meanwhile shows the 403 in place
 * of the page; an expired session goes to «Sessione scaduta».
 * `enabled={false}` (no Supabase env: CI, e2e, stories) checks nothing.
 */
export function AdminClientGuard({
  enabled,
  check = checkAdminInBrowser,
  children,
}: {
  enabled: boolean;
  /** Overrides the Supabase check (tests, stories). */
  check?: () => Promise<ClientRoleCheck>;
  children: ReactNode;
}) {
  const [denied, setDenied] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const location = useRef({ router, pathname });

  useEffect(() => {
    location.current = { router, pathname };
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const run = async () => {
      const result = await check();
      if (!active) return;
      if (result === "expired") {
        const { router, pathname } = location.current;
        router.replace(
          sessionExpiredHref(`${pathname}${window.location.search}`),
        );
      } else if (result === "denied") {
        setDenied(true);
      } else if (result === "admin") {
        setDenied(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, check]);

  if (denied) {
    return (
      <div data-slot="admin-client-guard" data-state="denied">
        <ForbiddenContent
          currentRole="giocatore"
          requiredRole="admin"
          documentTitle="Accesso negato"
        />
      </div>
    );
  }
  return <>{children}</>;
}
