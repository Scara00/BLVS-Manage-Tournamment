import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminSidebar } from "./admin-sidebar";
import { AppFooter } from "./app-footer";
import { PlayerNav } from "./player-nav";
import type { SignOutAction } from "./sign-out-button";
import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";
import { Topbar } from "./topbar";

/**
 * Page frame: skip link, black Topbar, optional sidebar, the `main`
 * landmark the skip link targets, and the footer with the privacy link.
 * Layouts switch at `md` in CSS only.
 */
export function AppShell({
  variant,
  signOut,
  nav,
  sidebar,
  topbarActions,
  children,
}: {
  variant: "player" | "admin";
  /** Server action behind «Esci». */
  signOut: SignOutAction;
  /** Overrides the variant's default Topbar navigation. */
  nav?: ReactNode;
  /** Overrides the variant's default sidebar. */
  sidebar?: ReactNode;
  /** Controls in the Topbar before «Esci» (admin: the command palette). */
  topbarActions?: ReactNode;
  children: ReactNode;
}) {
  const isPlayer = variant === "player";
  const topbarNav =
    nav ?? (isPlayer ? <PlayerNav signOut={signOut} /> : undefined);
  const aside = sidebar ?? (isPlayer ? undefined : <AdminSidebar />);

  return (
    <>
      <SkipLink />
      <Topbar
        nav={topbarNav}
        signOut={signOut}
        signOutOnMobile={!isPlayer}
        label={isPlayer ? undefined : "Admin"}
        homeHref={isPlayer ? "/" : "/admin"}
        actions={topbarActions}
        fullBleed={aside !== undefined}
      />
      <div className="flex flex-1 flex-col md:flex-row">
        {aside}
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={cn(
            "flex min-w-0 flex-1 flex-col focus:outline-none",
            // Beside the sidebar the page column starts at it: no band
            // between them on wide monitors.
            aside !== undefined && "[--frame-margin:0]",
          )}
        >
          {children}
        </main>
      </div>
      <AppFooter fullBleed={aside !== undefined} />
    </>
  );
}
