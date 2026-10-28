import type { ReactNode } from "react";

/**
 * The greeting (the page's h1) with, on the race day, the compact Live bar
 * beside it; the bar wraps under the greeting on narrow screens.
 */
export function HomeHeader({
  saluto,
  children,
}: {
  saluto: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-space-5 gap-y-space-3">
      <h1
        data-testid="home-saluto"
        className="font-heading text-3xl font-semibold tracking-tight text-balance [overflow-wrap:anywhere] md:text-4xl"
      >
        {saluto}
      </h1>
      {children}
    </header>
  );
}
