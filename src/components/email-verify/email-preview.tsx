import { useId } from "react";
import { CONFIRMATION_LINK_TTL_SECONDS } from "@/lib/auth/email-verification/constants";
import {
  confermaEmailCopy,
  confermaEmailSubject,
} from "@/lib/email/templates/conferma-email-copy";
import { cn } from "@/lib/utils";

/**
 * Picture of the email the player just received, so they know what to look
 * for. Labelled as a preview and not interactive: the «button» is a plain
 * `span` (no link, no tabindex, no role), so it never takes focus and is not
 * announced as a control. The copy comes from the real template.
 */
export function EmailPreview({
  email,
  className,
}: {
  email?: string;
  className?: string;
}) {
  const captionId = useId();
  return (
    <figure
      data-slot="email-preview"
      aria-labelledby={captionId}
      className={cn("flex flex-col gap-space-2", className)}
    >
      <figcaption
        id={captionId}
        className="text-sm font-semibold text-foreground"
      >
        Anteprima dell&apos;email (non interattiva)
      </figcaption>
      <div className="flex flex-col gap-space-3 border-2 border-input bg-background p-inset select-none">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-space-3 gap-y-space-1 text-sm">
          <dt className="font-semibold">Oggetto</dt>
          <dd className="break-words">{confermaEmailSubject}</dd>
          {email ? (
            <>
              <dt className="font-semibold">A</dt>
              <dd className="font-mono break-all">{email}</dd>
            </>
          ) : null}
        </dl>
        <div aria-hidden="true" className="h-1 w-full bg-tape" />
        <p className="font-heading text-lg font-semibold">
          {confermaEmailCopy.heading}
        </p>
        <p>{confermaEmailCopy.intro}</p>
        <p>{confermaEmailCopy.validity(CONFIRMATION_LINK_TTL_SECONDS / 60)}</p>
        <span
          data-slot="email-preview-action"
          className="self-start bg-primary px-space-4 py-space-2 font-heading font-semibold text-primary-foreground"
        >
          {confermaEmailCopy.action}
        </span>
      </div>
    </figure>
  );
}
