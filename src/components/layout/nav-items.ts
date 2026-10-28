import { TicketIcon, UserIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Desktop secondary items show only this icon between md and lg. */
  icon?: LucideIcon;
  /** Active only on an exact path match (for index routes like `/`). */
  exact?: boolean;
  /**
   * Secondary item also shown in the desktop bar (outside the menu); "lg"
   * only from lg: between md and lg the bar has no room at 200% text.
   */
  desktop?: boolean | "lg";
};

/** Player sections: always one tap away, on mobile too. */
export const playerPrimaryNav: readonly NavItem[] = [
  { href: "/tappe", label: "Tappe" },
  { href: "/live", label: "Live" },
  { href: "/classifica", label: "Classifica" },
  { href: "/regole", label: "Regole" },
];

/** Secondary player links, behind the mobile «Menu» disclosure. */
export const playerSecondaryNav: readonly NavItem[] = [
  { href: "/", label: "Home", exact: true },
  {
    href: "/iscrizioni",
    label: "Le mie iscrizioni",
    desktop: "lg",
    icon: TicketIcon,
  },
  { href: "/profilo", label: "Profilo", desktop: true, icon: UserIcon },
  { href: "/impostazioni", label: "Impostazioni" },
];

export const adminNav: readonly NavItem[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/tappe", label: "Tappe" },
  { href: "/admin/iscrizioni", label: "Iscrizioni" },
  { href: "/admin/giocatori", label: "Giocatori" },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
