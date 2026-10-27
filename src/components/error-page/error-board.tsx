import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FlipDigits } from "../scoreboard/flip-digits";
import { Tape } from "../scoreboard/tape";

export type ErrorBoardProps = {
  /** HTTP status shown on the flaps, e.g. 404. */
  code: number;
  /** Text heading of the page: the flaps are decoration only. */
  title: string;
  /** Mini scoreboard under the heading. */
  board?: ReactNode;
  /** What happened and what to do next. */
  children?: ReactNode;
  /** Links and buttons, laid out on one row that wraps when space runs out. */
  actions?: ReactNode;
  /**
   * Renders `<title>` (React 19 hoists it into `<head>`) where route metadata
   * does not apply: `forbidden.tsx`, nested `not-found.tsx`, `error.tsx`.
   */
  documentTitle?: string;
  className?: string;
};

/**
 * Shared frame of the error pages. Static flaps (`aria-hidden`, never
 * animated), a tape divider, a text `h1`, the board, the message and actions.
 */
export function ErrorBoard({
  code,
  title,
  board,
  children,
  actions,
  documentTitle,
  className,
}: ErrorBoardProps) {
  return (
    <div
      data-slot="error-board"
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-8",
        className,
      )}
    >
      {documentTitle ? <title>{`${documentTitle} · BLVS`}</title> : null}
      {/* Container units, not rem: at 200 % text rem-sized flaps overflow
          the column next to the admin sidebar. */}
      <div aria-hidden="true" className="@container flex flex-col gap-space-3">
        <FlipDigits
          value={code}
          reducedMotion
          className="text-[min(6rem,30cqi)] font-semibold"
        />
        <Tape size={8} />
      </div>
      <header className="flex flex-col gap-space-2">
        <p className="font-mono text-sm font-semibold tracking-widest text-foreground uppercase">
          Errore {code}
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance text-foreground md:text-4xl">
          {title}
        </h1>
      </header>
      {board}
      {children ? (
        <div className="flex max-w-prose flex-col gap-space-3 text-lg text-pretty text-foreground">
          {children}
        </div>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap items-center gap-space-3">{actions}</div>
      ) : null}
    </div>
  );
}
