"use client";

import { useMemo } from "react";
import type { PrivacySection } from "@/lib/legal/privacy-policy";
import { cn } from "@/lib/utils";
import { useActiveSection } from "./use-active-section";

/**
 * «Indice» of the privacy page. The current section is marked with
 * `aria-current="location"` plus a tape bar and bold text, never colour
 * alone. Following a link also moves focus to the section, so keyboard and
 * screen reader users continue reading from there.
 */
export function PrivacyIndex({
  sections,
  className,
}: {
  sections: readonly PrivacySection[];
  className?: string;
}) {
  const key = sections.map((s) => s.id).join(" ");
  const ids = useMemo(() => key.split(" "), [key]);
  const { active, select } = useActiveSection(ids);

  const onClick = (id: string) => {
    select(id);
    // The default action still scrolls to the hash and updates the URL.
    document.getElementById(id)?.focus({ preventScroll: true });
  };

  return (
    <nav aria-labelledby="indice-privacy" className={className}>
      <h2
        id="indice-privacy"
        className="mb-space-3 font-heading text-lg font-semibold"
      >
        Indice
      </h2>
      <ol className="flex flex-col gap-space-1 border-l-2 border-border">
        {sections.map((section) => {
          const current = section.id === active;
          return (
            <li key={section.id} className="-ml-0.5">
              <a
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                onClick={() => onClick(section.id)}
                className={cn(
                  "flex min-h-11 items-center border-l-4 border-transparent py-space-1 pl-space-3 text-pretty focus-ring",
                  "not-aria-[current=location]:hover:border-neutral-400 not-aria-[current=location]:hover:underline",
                  "aria-[current=location]:border-tape-strong aria-[current=location]:font-bold",
                )}
              >
                {section.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
