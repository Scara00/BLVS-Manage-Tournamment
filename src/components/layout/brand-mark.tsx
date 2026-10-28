import { cn } from "@/lib/utils";

/**
 * The BLVS logo («Beach Life Volley Soul»). `public/logo-blvs.png` (156×69,
 * black on transparent) is only a shape: it masks a box painted in the
 * current text colour, so the logo is white on the black bars. In forced
 * colours it takes the system text colour. Decorative: the link or text
 * around it names the brand.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="brand-mark"
      className={cn(
        "inline-block aspect-[156/69] h-11 shrink-0 bg-current mask-[url(/logo-blvs.png)] mask-contain mask-center mask-no-repeat forced-color-adjust-none forced-colors:bg-[CanvasText]",
        className,
      )}
    />
  );
}
