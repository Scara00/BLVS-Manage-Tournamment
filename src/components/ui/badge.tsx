import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-space-1 border px-space-2 py-space-1 font-heading text-sm leading-4 font-semibold [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "border-neutral-300 bg-neutral-100 text-neutral-800",
        success: "border-transparent bg-success-bg text-success-fg",
        error: "border-transparent bg-error-bg text-error-fg",
        warning: "border-transparent bg-warning-bg text-warning-fg",
        info: "border-transparent bg-info-bg text-info-fg",
        live: "border-transparent bg-live-bg text-live-fg",
        "reg-draft": "border-transparent bg-reg-draft-bg text-reg-draft-fg",
        "reg-open": "border-transparent bg-reg-open-bg text-reg-open-fg",
        "reg-closed": "border-transparent bg-reg-closed-bg text-reg-closed-fg",
        "reg-cancelled":
          "border-transparent bg-reg-cancelled-bg text-reg-cancelled-fg",
        /** Black on yellow tape (contrastPairs «Nero su tape»). */
        tape: "border-transparent bg-tape text-primary",
      },
      shape: {
        square: "rounded-none",
        pill: "rounded-full",
      },
    },
    defaultVariants: { variant: "neutral", shape: "square" },
  },
);

/**
 * A badge always carries text: visible `children`, or an `icon` with a
 * screen-reader `label`. A colour-only badge does not type-check.
 */
type BadgeContent =
  | { children: ReactNode; icon?: ReactNode; label?: never }
  | { icon: ReactNode; label: string; children?: never };

type BadgeProps = Omit<ComponentProps<"span">, "children"> &
  VariantProps<typeof badgeVariants> &
  BadgeContent;

function Badge({
  className,
  variant,
  shape,
  icon,
  label,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? "neutral"}
      className={cn(badgeVariants({ variant, shape }), className)}
      {...props}
    >
      {icon != null && (
        <span aria-hidden className="flex">
          {icon}
        </span>
      )}
      {children ?? <span className="sr-only">{label}</span>}
    </span>
  );
}

export { Badge, badgeVariants, type BadgeProps };
