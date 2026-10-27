import { cn } from "cn";

const tones = {
  default: "text-primary",
  inverse: "bg-primary px-[0.25em] text-primary-foreground",
  tape: "bg-tape px-[0.25em] text-primary",
} as const;

type ScoreDigitsProps = {
  value: number;
  /** Fixed width in digits, so a column of scores lines up. */
  digits?: number;
  /** Standing position: shows «N°», reads «N° posto». */
  ordinal?: boolean;
  tone?: keyof typeof tones;
  /** The single text read by screen readers. */
  label?: string;
  className?: string;
};

/** Static score or standing number, right-aligned on tabular figures. */
function ScoreDigits({
  value,
  digits,
  ordinal = false,
  tone = "default",
  label,
  className,
}: ScoreDigitsProps) {
  const visible = ordinal ? `${value}°` : String(value);
  return (
    <span
      data-slot="score-digits"
      className={cn(
        "box-content inline-block rounded-none text-right font-mono whitespace-nowrap tabular-nums",
        tones[tone],
        className,
      )}
      style={
        digits ? { minWidth: `${digits + (ordinal ? 1 : 0)}ch` } : undefined
      }
    >
      <span className="sr-only">
        {label ?? (ordinal ? `${value}° posto` : String(value))}
      </span>
      <span aria-hidden="true">{visible}</span>
    </span>
  );
}

export { ScoreDigits, type ScoreDigitsProps };
