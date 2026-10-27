"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { useFieldControl, type FieldSize } from "./field";

/** Shared look of text-like controls (Input, Select). */
const controlVariants = cva(
  "focus-ring w-full min-w-0 rounded-none border-2 border-input bg-background px-space-3 py-space-2 text-foreground transition-colors placeholder:text-muted-foreground aria-invalid:border-error-fg aria-invalid:shadow-[inset_0_0_0_1px_var(--color-error-fg)] disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-muted-foreground",
  {
    variants: {
      size: {
        default: "min-h-11 text-base",
        campo: "min-h-12 px-space-4 text-lg",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type InputProps = Omit<InputPrimitive.Props, "size" | "className"> & {
  /** `campo`: 48px tall, larger text. Inherited from the Field. */
  size?: FieldSize;
  className?: string;
};

function Input({
  className,
  size,
  id,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
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
    <InputPrimitive
      data-slot="input"
      {...props}
      {...controlProps}
      className={cn(controlVariants({ size: fieldSize }), className)}
    />
  );
}

export { controlVariants, Input, type InputProps };
