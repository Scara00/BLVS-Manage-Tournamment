import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2Icon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { mergeIds } from "@/lib/utils";

const buttonVariants = cva(
  // min-h (not h) and whitespace-normal: labels wrap instead of clipping at 200% text.
  "group/button focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-space-2 rounded-none border-2 border-transparent text-center font-heading font-semibold whitespace-normal transition-colors select-none data-disabled:cursor-not-allowed data-inactive:border-neutral-300 data-inactive:bg-neutral-100 data-inactive:text-neutral-500 data-inactive:no-underline aria-busy:cursor-wait [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.25em]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground not-data-disabled:hover:bg-neutral-700",
        secondary:
          "border-primary bg-background text-primary not-data-disabled:hover:bg-neutral-100",
        destructive:
          "bg-error-fg text-primary-foreground not-data-disabled:hover:bg-live-bg",
        link: "text-primary underline decoration-2 underline-offset-4 not-data-disabled:hover:decoration-4",
      },
      size: {
        sm: "min-h-10 px-space-4 text-sm",
        default: "min-h-11 px-space-5 text-base",
        /** "Bordo campo": courtside use, gloves or wet hands. */
        campo: "min-h-12 min-w-12 px-space-5 text-lg",
        icon: "size-11",
        "icon-campo": "size-12 [&_svg:not([class*='size-'])]:size-6",
        /** 56px steppers (−/+) for score entry, used one-handed. */
        "icon-campo-lg": "size-14 [&_svg:not([class*='size-'])]:size-7",
      },
    },
    compoundVariants: [
      // Links keep a 24px hit area but no button padding.
      { variant: "link", className: "min-h-6 min-w-6 px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner, sets aria-busy and blocks activation; focus stays. */
    loading?: boolean;
    /** Visible explanation shown, and announced, while `disabled`. */
    disabledReason?: ReactNode;
  };

function Button({
  className,
  variant = "primary",
  size = "default",
  loading = false,
  disabled = false,
  disabledReason,
  focusableWhenDisabled,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ButtonProps) {
  const reasonId = useId();
  const showReason = disabled && disabledReason != null;

  const button = (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-inactive={disabled && !loading ? "" : undefined}
      disabled={disabled || loading}
      focusableWhenDisabled={focusableWhenDisabled ?? (loading || showReason)}
      aria-busy={loading || undefined}
      aria-describedby={mergeIds(
        ariaDescribedBy,
        showReason ? reasonId : undefined,
      )}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && (
        <Loader2Icon
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
      {loading && <span className="sr-only">Caricamento…</span>}
    </ButtonPrimitive>
  );

  if (!showReason) return button;

  return (
    <div className="inline-flex flex-col items-start gap-space-1">
      {button}
      <p id={reasonId} className="text-sm text-muted-foreground">
        {disabledReason}
      </p>
    </div>
  );
}

export { Button, buttonVariants, type ButtonProps };
