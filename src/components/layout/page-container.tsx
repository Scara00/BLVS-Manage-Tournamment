import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Content column of a page inside AppShell, with its `h1`. */
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
        "mx-auto flex w-full max-w-6xl flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-7",
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
