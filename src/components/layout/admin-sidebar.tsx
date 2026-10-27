"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { adminNav, isNavItemActive, type NavItem } from "./nav-items";
import { useNavDisclosure } from "./use-nav-disclosure";

function AdminNavList({
  items,
  pathname,
  tone,
}: {
  items: readonly NavItem[];
  pathname: string;
  tone: "dark" | "light";
}) {
  return (
    <ul className="flex flex-col gap-space-1">
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center border-l-4 border-transparent px-space-4 py-space-2 font-heading font-medium break-words",
                "aria-[current=page]:border-primary aria-[current=page]:bg-tape aria-[current=page]:font-bold aria-[current=page]:text-primary",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                tone === "dark"
                  ? "not-aria-[current=page]:hover:bg-neutral-800 focus-visible:outline-primary-foreground"
                  : "not-aria-[current=page]:hover:bg-neutral-100 focus-visible:outline-ring",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Admin navigation: a black sidebar column from `md`, a compact
 * «Menu amministrazione» disclosure at the top of the content below it.
 */
export function AdminSidebar({
  items = adminNav,
}: {
  items?: readonly NavItem[];
}) {
  const { pathname, open, buttonProps, panelProps } = useNavDisclosure();

  return (
    <>
      <aside className="hidden w-64 max-w-1/3 shrink-0 flex-col bg-primary py-space-5 text-primary-foreground md:flex">
        <nav aria-label="Amministrazione" className="px-space-3">
          <AdminNavList items={items} pathname={pathname} tone="dark" />
        </nav>
      </aside>

      <div className="border-b border-border bg-neutral-50 px-inset py-space-2 md:hidden">
        <button
          {...buttonProps}
          className="inline-flex min-h-11 w-full items-center justify-between gap-space-2 border border-input bg-background px-space-4 font-heading font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Menu amministrazione
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-5 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
        <nav
          {...panelProps}
          aria-label="Amministrazione"
          className="pt-space-2"
        >
          <AdminNavList items={items} pathname={pathname} tone="light" />
        </nav>
      </div>
    </>
  );
}
