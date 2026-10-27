import { cn } from "@/lib/utils";

export const MAIN_CONTENT_ID = "contenuto";

/** First focusable element of every page: jumps past the navigation. */
export function SkipLink({ className }: { className?: string }) {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className={cn(
        "sr-only z-50 bg-tape font-heading font-semibold text-primary underline underline-offset-4",
        "focus:not-sr-only focus:fixed focus:top-space-2 focus:left-space-2 focus:px-space-4 focus:py-space-3",
        "focus-visible:outline-4 focus-visible:outline-offset-0 focus-visible:outline-primary",
        className,
      )}
    >
      Vai al contenuto
    </a>
  );
}
