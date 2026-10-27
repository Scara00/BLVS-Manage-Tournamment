"use client";

import { cn } from "cn";
import type { ComponentProps } from "react";
import { useFieldControl, type FieldSize } from "./field";
import { controlVariants } from "./input";

type TextareaProps = Omit<ComponentProps<"textarea">, "size"> & {
  /** `campo`: larger text. Inherited from the Field. */
  size?: FieldSize;
};

/** Multi-line text control; links to its Field like `Input`. */
function Textarea({
  className,
  size,
  id,
  disabled,
  required,
  rows = 4,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaProps) {
  const field = useFieldControl({
    id,
    disabled,
    required,
    size,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  });
  const { size: fieldSize, ...controlProps } = field;

  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      {...props}
      {...controlProps}
      className={cn(
        controlVariants({ size: fieldSize }),
        "[field-sizing:content] min-h-24 resize-y",
        className,
      )}
    />
  );
}

export { Textarea, type TextareaProps };
