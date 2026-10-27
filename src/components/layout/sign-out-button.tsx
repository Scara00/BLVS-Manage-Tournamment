"use client";

import { LogOutIcon } from "lucide-react";
import { useActionState, type MouseEvent } from "react";
import {
  initialSignOutState,
  type SignOutState,
} from "@/lib/auth/sign-out-state";
import { cn } from "@/lib/utils";

export type SignOutAction = (
  prevState: SignOutState,
  formData: FormData,
) => Promise<SignOutState>;

/** «Esci»: a form posting to the sign-out server action, for the black bars. */
export function SignOutButton({
  action,
  block = false,
  className,
}: {
  action: SignOutAction;
  /** Full-width row, for the mobile menu panel. */
  block?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialSignOutState,
  );

  // aria-disabled instead of disabled, so focus stays on the button while
  // the action runs; the click guard blocks a second submit.
  function onClick(event: MouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  return (
    <form action={formAction} className={className}>
      <button
        type="submit"
        aria-disabled={pending || undefined}
        onClick={onClick}
        className={cn(
          "inline-flex min-h-11 items-center gap-space-2 border border-primary-foreground px-space-4 py-space-2 font-heading font-medium text-primary-foreground transition-colors",
          "hover:bg-primary-foreground hover:text-primary",
          block && "w-full",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground",
        )}
      >
        <LogOutIcon aria-hidden className="size-4 shrink-0" />
        Esci
      </button>
      {state.error ? (
        <p role="alert" className="pt-space-1 text-sm text-primary-foreground">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
