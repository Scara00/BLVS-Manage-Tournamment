import { REGISTRATION_STEPS } from "@/lib/auth/email-verification/constants";
import { cn } from "@/lib/utils";

/**
 * «Passo N di 3» of the registration, with the list of steps. The current
 * one has `aria-current="step"`, bold text and a tape underline (never
 * colour alone); done steps say so in text.
 */
export function RegistrationSteps({
  current,
  className,
}: {
  /** 1-based index in REGISTRATION_STEPS. */
  current: number;
  className?: string;
}) {
  const total = REGISTRATION_STEPS.length;
  return (
    <nav
      aria-label="Passaggi della registrazione"
      data-slot="registration-steps"
      className={cn("flex flex-col gap-space-3", className)}
    >
      <p className="self-start bg-tape px-space-3 py-space-1 font-mono text-sm font-semibold tracking-widest text-primary uppercase">
        Passo {current} di {total}
      </p>
      <ol className="flex flex-wrap gap-x-space-5 gap-y-space-2">
        {REGISTRATION_STEPS.map((label, index) => {
          const step = index + 1;
          const state =
            step < current ? "fatto" : step === current ? "attuale" : "dopo";
          return (
            <li
              key={label}
              aria-current={state === "attuale" ? "step" : undefined}
              className={cn(
                "flex items-baseline gap-space-2 border-b-4 pb-space-1",
                state === "attuale"
                  ? "border-tape font-semibold text-foreground"
                  : "border-transparent text-foreground",
              )}
            >
              <span className="font-mono tabular-nums" aria-hidden="true">
                {step}.
              </span>
              <span>
                {label}
                {state === "fatto" ? (
                  <span className="sr-only"> (completato)</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
