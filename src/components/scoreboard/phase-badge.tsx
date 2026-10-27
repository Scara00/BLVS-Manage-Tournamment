import { cn } from "cn";

const phases = {
  gold: {
    icon: "★",
    text: "Gold",
    className: "border-tape bg-tape text-primary",
  },
  silver: {
    icon: "◆",
    text: "Silver",
    className: "border-input bg-neutral-100 text-neutral-800",
  },
} as const;

type Phase = keyof typeof phases;

type PhaseBadgeProps = {
  phase: Phase;
  className?: string;
};

/** Gold / Silver bracket phase. Flat colours; the text carries the meaning. */
function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  const { icon, text, className: tone } = phases[phase];
  return (
    <span
      data-slot="phase-badge"
      data-phase={phase}
      className={cn(
        "inline-flex items-center gap-space-1 rounded-none border px-space-2 py-0.5 font-heading text-xs font-semibold tracking-wider uppercase",
        tone,
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {text}
    </span>
  );
}

export { PhaseBadge, type Phase, type PhaseBadgeProps };
