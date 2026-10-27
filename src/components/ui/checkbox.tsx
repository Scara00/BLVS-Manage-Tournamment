"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { mergeIds } from "@/lib/utils";
import { useFieldControl, type FieldSize } from "./field";

type CheckboxProps = Omit<
  CheckboxPrimitive.Root.Props,
  "children" | "className" | "size"
> & {
  /** Visible label: the whole row is clickable. */
  label: ReactNode;
  /** Secondary text under the label, linked via aria-describedby. */
  description?: ReactNode;
  /** `campo`: 48px row and a larger box. Inherited from the Fieldset. */
  size?: FieldSize;
  className?: string;
};

/**
 * Checkbox in a clickable label row. The checked state is a tick icon, not
 * only a colour change. Use inside a `Fieldset` to get a legend, hint and
 * error linked to it.
 */
function Checkbox({
  label,
  description,
  size,
  className,
  id,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: CheckboxProps) {
  const base = useId();
  const labelId = `${base}-label`;
  const descriptionId = `${base}-description`;
  const field = useFieldControl({
    id,
    disabled,
    required,
    size,
    "aria-describedby": mergeIds(
      ariaDescribedBy,
      description != null && descriptionId,
    ),
    "aria-invalid": ariaInvalid,
  });
  const campo = field.size === "campo";

  return (
    <label
      data-slot="checkbox"
      className={cn(
        "flex cursor-pointer items-start gap-space-3 text-foreground has-data-disabled:cursor-not-allowed has-data-disabled:text-muted-foreground",
        campo ? "min-h-12 py-space-2 text-lg" : "min-h-6 text-base",
        className,
      )}
    >
      <CheckboxPrimitive.Root
        {...props}
        id={field.id}
        disabled={field.disabled}
        required={field.required}
        aria-labelledby={labelId}
        aria-describedby={field["aria-describedby"]}
        aria-invalid={field["aria-invalid"]}
        aria-busy={field["aria-busy"]}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-none border-2 border-input bg-background text-primary-foreground focus-ring transition-colors aria-invalid:border-error-fg data-checked:border-primary data-checked:bg-primary data-disabled:border-neutral-300 data-disabled:bg-neutral-100 data-disabled:text-neutral-500",
          // Centre the box on the first line of text.
          campo ? "mt-0.5 size-6" : "mt-0.5 size-5",
        )}
      >
        <CheckboxPrimitive.Indicator className="flex data-unchecked:hidden">
          <CheckIcon
            aria-hidden
            strokeWidth={3}
            className={campo ? "size-5" : "size-4"}
          />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className="flex flex-col gap-space-1">
        <span id={labelId}>{label}</span>
        {description != null && (
          <span id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export { Checkbox, type CheckboxProps };
