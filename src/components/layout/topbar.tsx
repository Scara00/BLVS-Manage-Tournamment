import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SignOutButton, type SignOutAction } from "./sign-out-button";
import { TopbarHeight } from "./topbar-height";

/**
 * Black brand bar (banner landmark). Sticky from `md` only: on phones it
 * scrolls away so it never eats the viewport at large text sizes.
 */
export function Topbar({
  nav,
  signOut,
  signOutOnMobile = true,
  homeHref = "/",
  label,
  actions,
}: {
  /** Navigation rendered after the mark (see PlayerNav). */
  nav?: ReactNode;
  signOut: SignOutAction;
  /** False when the mobile nav already offers «Esci» in its menu. */
  signOutOnMobile?: boolean;
  homeHref?: string;
  /** Optional area label next to the mark, e.g. "Admin". */
  label?: string;
  /** Controls before «Esci», e.g. the admin «Cerca» (BLVS-55). */
  actions?: ReactNode;
}) {
  return (
    <header className="z-40 bg-primary text-primary-foreground md:sticky md:top-0">
      <TopbarHeight />
      <div className="mx-auto flex min-h-(--spacing-space-8) w-full max-w-screen-2xl flex-wrap items-center gap-x-space-5 gap-y-space-2 px-inset py-space-2 md:flex-nowrap md:px-inset-lg">
        <Link
          href={homeHref}
          className="mr-auto inline-flex min-h-11 items-center gap-space-2 font-heading text-2xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground md:mr-0"
        >
          BLVS
          {label ? (
            <span className="bg-tape px-space-2 py-space-1 text-xs font-semibold tracking-wide text-primary uppercase">
              {label}
            </span>
          ) : null}
          <span className="sr-only"> – vai alla home</span>
        </Link>
        {nav}
        {actions ? <div className="md:ml-auto">{actions}</div> : null}
        <SignOutButton
          action={signOut}
          className={cn(
            !actions && "md:ml-auto",
            !signOutOnMobile && "hidden md:block",
          )}
        />
      </div>
    </header>
  );
}
