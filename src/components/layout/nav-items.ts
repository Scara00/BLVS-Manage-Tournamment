export type NavItem = {
  href: string;
  label: string;
  /** Active only on an exact path match (for index routes like `/`). */
  exact?: boolean;
};

/** Player sections: always one tap away, on mobile too. */
export const playerPrimaryNav: readonly NavItem[] = [
  { href: "/tappe", label: "Tappe" },
  { href: "/live", label: "Live" },
  { href: "/classifica", label: "Classifica" },
];

/** Secondary player links, behind the mobile «Menu» disclosure. */
export const playerSecondaryNav: readonly NavItem[] = [
  { href: "/", label: "Home", exact: true },
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
