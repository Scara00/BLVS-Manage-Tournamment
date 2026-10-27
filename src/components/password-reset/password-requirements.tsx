import { CheckIcon, XIcon } from "lucide-react";
import type { RequirementResult } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";

/**
 * The new-password rules with their outcome. Colour and icon are backed by
 * the words «fatto» / «manca», so the result is never colour or shape only.
 * It is not a live region: the user reads it on demand (it is linked to the
 * field with aria-describedby), it does not talk on every keystroke.
 */
export function PasswordRequirements({
  id,
  results,
}: {
  id: string;
  results: RequirementResult[];
}) {
  return (
    <div id={id} className="flex flex-col gap-space-2">
      <p className="font-heading font-semibold">Requisiti della password:</p>
      <ul className="flex flex-col gap-space-1">
        {results.map((r) => (
          <li
            key={r.id}
            data-met={r.met}
            className={cn(
              "flex items-start gap-space-2",
              r.met ? "text-success-fg" : "text-error-fg",
            )}
          >
            {r.met ? (
              <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            ) : (
              <XIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            )}
            <span>
              <span className="text-foreground">{r.label}</span>:{" "}
              <strong>{r.met ? "fatto" : "manca"}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
