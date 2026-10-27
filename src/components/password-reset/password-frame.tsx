"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Tape } from "@/components/scoreboard";
import { cn } from "@/lib/utils";

type PasswordFrameProps = {
  title: string;
  description?: ReactNode;
  /**
   * Moves focus to the h1 on mount: used when a view replaces another on
   * the same page (form → «Controlla la tua email»), so screen reader and
   * keyboard users start from the new heading.
   */
  focusHeading?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * Narrow column of the password screens (w-forgot, w-forgot-sent, w-reset):
 * eyebrow, h1 over the yellow court tape, description, content.
 */
export function PasswordFrame({
  title,
  description,
  focusHeading = false,
  className,
  children,
}: PasswordFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col gap-stack-lg px-inset py-space-6 md:py-space-7",
        className,
      )}
    >
      <header className="flex flex-col gap-space-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Accesso
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-3xl font-semibold tracking-tight text-balance focus:outline-none md:text-4xl"
        >
          {title}
        </h1>
        <Tape size={8} className="max-w-24" />
        {description ? (
          <div className="flex max-w-prose flex-col gap-space-2 text-lg text-pretty">
            {description}
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}

/** Error banner of a whole form (offline, network, server message). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-l-4 border-error-fg bg-error-bg px-space-4 py-space-3 font-semibold text-error-fg"
    >
      {children}
    </p>
  );
}
