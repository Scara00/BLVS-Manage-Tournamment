import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Content column of a page inside AppShell, with its `h1`: as wide as the
 * page frame, centred, or against the sidebar when the shell sets
 * `--frame-margin: 0`.
 */
export function PageContainer({
  title,
  eyebrow,
  description,
  className,
  children,
}: {
  title: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-[var(--frame-margin,auto)] flex w-full max-w-frame flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-7",
        className,
      )}
    >
      <header className="flex flex-col gap-space-2">
        {eyebrow ? (
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-lg text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
