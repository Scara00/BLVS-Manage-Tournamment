import { LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SignOutAction = (formData: FormData) => void | Promise<void>;

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
  return (
    <form action={action} className={className}>
      <button
        type="submit"
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
    </form>
  );
}
