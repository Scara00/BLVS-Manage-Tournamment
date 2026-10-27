import { cn } from "cn";

const labels = { maschile: "Maschile", femminile: "Femminile" } as const;

type Category = keyof typeof labels;

type CategoryLabelProps = {
  category: Category;
  className?: string;
};

/** Tournament category as plain text: no colour coding, no icon. */
function CategoryLabel({ category, className }: CategoryLabelProps) {
  return (
    <span
      data-slot="category-label"
      className={cn(
        "font-heading text-xs font-semibold tracking-wider text-foreground uppercase",
        className,
      )}
    >
      {labels[category]}
    </span>
  );
}

export { CategoryLabel, type Category, type CategoryLabelProps };
