import { CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The result of a cancel, where focus lands once the dialog closes (the
 * button that opened it is gone). Always in the DOM so the status region
 * exists before its text changes.
 */
export function EsitoAnnullamento({
  id,
  message,
  className,
}: {
  id: string;
  message: string | null;
  className?: string;
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      role="status"
      data-testid="esito-annullamento"
      className={cn(
        "focus-ring",
        message
          ? "flex items-start gap-space-2 border-2 border-primary p-inset font-semibold"
          : "sr-only",
        className,
      )}
    >
      {message ? (
        <>
          <CheckCircle2Icon aria-hidden className="mt-1 size-5 shrink-0" />
          <p>{message}</p>
        </>
      ) : null}
    </div>
  );
}
