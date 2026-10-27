"use client";

import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useFieldControl, type FieldSize } from "./field";
import { controlVariants } from "./input";

type SelectProps = Omit<ComponentProps<"select">, "size"> & {
  /** `campo`: 48px tall, larger text. Inherited from the Field. */
  size?: FieldSize;
  /** Empty first option, e.g. "Scegli una categoria". */
  placeholder?: string;
};

/**
 * Native <select> with the BLVS look: the platform picker is the most
 * reliable choice on mobile and with screen readers.
 */
function Select({
  className,
  size,
  id,
  disabled,
  required,
  placeholder,
  children,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectProps) {
  const { size: fieldSize, ...controlProps } = useFieldControl({
    id,
    disabled,
    required,
    size,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  });

  return (
    <div data-slot="select" className={cn("relative w-full", className)}>
      <select
        {...props}
        {...controlProps}
        className={cn(
          controlVariants({ size: fieldSize }),
          "cursor-pointer appearance-none pr-space-7",
        )}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-space-3 -translate-y-1/2 text-foreground",
          fieldSize === "campo" ? "size-6" : "size-5",
        )}
      />
    </div>
  );
}

export { Select, type SelectProps };
