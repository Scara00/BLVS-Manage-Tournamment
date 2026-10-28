"use client";

import { MenuIcon, UserIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  playerPrimaryNav,
  playerSecondaryNav,
  type NavItem,
} from "./nav-items";
import { SignOutButton, type SignOutAction } from "./sign-out-button";
import { useNavDisclosure } from "./use-nav-disclosure";

/** Focus ring that stays visible on the black bar. */
const focusOnDark =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground";

/**
 * Player navigation inside the Topbar. Tappe/Live/Classifica are always
 * visible (one tap on phones); secondary links and «Esci» live behind the
 * «Menu» disclosure on mobile.
 */
export function PlayerNav({
  signOut,
  primary = playerPrimaryNav,
  secondary = playerSecondaryNav,
}: {
  signOut: SignOutAction;
  primary?: readonly NavItem[];
  secondary?: readonly NavItem[];
}) {
  const { pathname, open, buttonProps, panelProps } = useNavDisclosure();

  return (
    <>
      <button
        {...buttonProps}
        className={cn(
          "inline-flex min-h-11 items-center gap-space-2 px-space-3 font-heading font-medium md:hidden",
          "aria-expanded:bg-primary-foreground aria-expanded:text-primary",
          focusOnDark,
        )}
      >
        {open ? (
          <XIcon aria-hidden className="size-5 shrink-0" />
        ) : (
          <MenuIcon aria-hidden className="size-5 shrink-0" />
        )}
        Menu
      </button>

      <nav aria-label="Principale" className="basis-full md:basis-auto">
        <ul className="-mx-space-3 flex flex-wrap gap-x-space-1 md:mx-0 md:gap-x-space-2">
          {primary.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center border-b-4 border-transparent px-space-3 font-heading font-medium break-words",
                    "not-aria-[current=page]:hover:border-neutral-400",
                    "aria-[current=page]:border-tape aria-[current=page]:font-bold",
                    focusOnDark,
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account links (e.g. «Profilo») sit next to «Esci» from md. */}
      {secondary.some((item) => item.desktop) ? (
        <ul className="hidden md:ml-auto md:flex md:gap-x-space-2">
          {secondary
            .filter((item) => item.desktop)
            .map(({ icon: Icon = UserIcon, ...item }) => (
              <li
                key={item.href}
                className={
                  item.desktop === "lg" ? "hidden lg:block" : undefined
                }
              >
                <Link
                  href={item.href}
                  aria-current={
                    isNavItemActive(item, pathname) ? "page" : undefined
                  }
                  className={cn(
                    "inline-flex min-h-11 items-center border-b-4 border-transparent px-space-3 font-heading font-medium break-words",
                    "not-aria-[current=page]:hover:border-neutral-400",
                    "aria-[current=page]:border-tape aria-[current=page]:font-bold",
                    focusOnDark,
                  )}
                >
                  {/* Icon only between md and lg: the bar does not wrap. */}
                  <Icon aria-hidden className="size-5 shrink-0 lg:hidden" />
                  <span className="sr-only lg:not-sr-only">{item.label}</span>
                </Link>
              </li>
            ))}
        </ul>
      ) : null}

      <div
        {...panelProps}
        className="basis-full border-t border-neutral-600 pt-space-2 pb-space-3 md:hidden"
      >
        <ul className="flex flex-col gap-space-1">
          {secondary.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center border-l-4 border-transparent px-space-3 font-heading font-medium",
                    "aria-[current=page]:border-tape aria-[current=page]:font-bold",
                    focusOnDark,
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="pt-space-2">
            <SignOutButton action={signOut} block />
          </li>
        </ul>
      </div>
    </>
  );
}
