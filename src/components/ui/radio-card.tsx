"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import {
  FieldContext,
  FieldError,
  FieldHint,
  FieldStatus,
  RequiredMark,
  useFieldMessages,
  type FieldMessagesProps,
  type FieldSize,
} from "./field";

const RadioCardSizeContext = createContext<FieldSize>("default");

type RadioCardGroupProps<Value> = FieldMessagesProps &
  Omit<RadioGroupPrimitive.Props<Value>, "className" | "children"> & {
    /** Visible group label; names the radiogroup. */
    legend: ReactNode;
    className?: string;
    children: ReactNode;
  };

/**
 * A radiogroup of cards with its own visible legend, hint and error (it is
 * its own Field: no wrapper needed). Arrow keys move the selection.
 */
function RadioCardGroup<Value>({
  legend,
  hint,
  error,
  required = false,
  disabled = false,
  loading = false,
  size = "default",
  className,
  children,
  ...props
}: RadioCardGroupProps<Value>) {
  const { ids, describedBy } = useFieldMessages({ hint, error, loading });
  const invalid = error != null && error !== false;

  return (
    <FieldContext.Provider
      value={{ describedBy, invalid, disabled, required, loading, size }}
    >
      <RadioCardSizeContext.Provider value={size}>
        <div
          data-slot="radio-card-group"
          data-invalid={invalid || undefined}
          className={cn("flex flex-col gap-space-2", className)}
        >
          <div
            id={ids.label}
            className={cn(
              "font-heading font-semibold text-foreground",
              size === "campo" ? "text-lg" : "text-base",
            )}
          >
            {legend}
            {required && <RequiredMark />}
          </div>
          {hint != null && <FieldHint id={ids.hint}>{hint}</FieldHint>}
          <RadioGroupPrimitive
            {...props}
            disabled={disabled || loading}
            required={required}
            aria-labelledby={ids.label}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            aria-busy={loading || undefined}
            className="grid gap-space-3"
          >
            {children}
          </RadioGroupPrimitive>
          {loading && <FieldStatus id={ids.status} />}
          {invalid && <FieldError id={ids.error}>{error}</FieldError>}
        </div>
      </RadioCardSizeContext.Provider>
    </FieldContext.Provider>
  );
}

type RadioCardProps<Value> = Omit<
  RadioPrimitive.Root.Props<Value>,
  "className" | "children"
> & {
  /** Card title: the radio's accessible name. */
  title: ReactNode;
  /** Secondary text, linked via aria-describedby. */
  description?: ReactNode;
  className?: string;
};

/**
 * One option of a `RadioCardGroup`. Selected: black 4px border and a tick,
 * so the state never relies on colour alone.
 */
function RadioCard<Value>({
  title,
  description,
  className,
  ...props
}: RadioCardProps<Value>) {
  const size = useContext(RadioCardSizeContext);
  const field = useContext(FieldContext);
  const base = useId();
  const titleId = `${base}-title`;
  const descriptionId = `${base}-description`;
  const campo = size === "campo";

  return (
    <label
      data-slot="radio-card"
      className={cn(
        "flex cursor-pointer items-start gap-space-3 rounded-none border-2 border-input bg-background p-inset text-foreground focus-ring-within transition-colors hover:border-primary",
        // Selected: 2px border + 2px inset shadow = 4px, without layout shift.
        "has-data-checked:border-primary has-data-checked:shadow-[inset_0_0_0_2px_var(--color-primary)]",
        "has-data-disabled:cursor-not-allowed has-data-disabled:border-neutral-300 has-data-disabled:bg-neutral-100 has-data-disabled:text-muted-foreground has-data-disabled:hover:border-neutral-300",
        field?.invalid && "border-error-fg",
        campo ? "min-h-12 text-lg" : "min-h-11 text-base",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-space-1">
        <span id={titleId} className="font-heading font-semibold">
          {title}
        </span>
        {description != null && (
          <span id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <RadioPrimitive.Root
        {...props}
        aria-labelledby={titleId}
        aria-describedby={description != null ? descriptionId : undefined}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-none border-2 border-input bg-background text-primary-foreground outline-none data-checked:border-primary data-checked:bg-primary data-disabled:border-neutral-300",
          campo ? "size-7" : "size-6",
        )}
      >
        <RadioPrimitive.Indicator className="flex data-unchecked:hidden">
          <CheckIcon
            aria-hidden
            strokeWidth={3}
            className={campo ? "size-5" : "size-4"}
          />
        </RadioPrimitive.Indicator>
      </RadioPrimitive.Root>
    </label>
  );
}

export {
  RadioCard,
  RadioCardGroup,
  type RadioCardGroupProps,
  type RadioCardProps,
};
