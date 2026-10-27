import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A navigation action that looks like a Button. */
export function ActionLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return (
    <Link className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
