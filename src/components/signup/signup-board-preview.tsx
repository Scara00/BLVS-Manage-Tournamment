import { Tape } from "@/components/scoreboard";
import type { Categoria } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/** How a player appears on the board: «ROSSI M.». */
export function boardName(nome: string, cognome: string): string {
  const surname = cognome.trim().toLocaleUpperCase("it-IT");
  const initial = nome.trim().charAt(0).toLocaleUpperCase("it-IT");
  if (!surname && !initial) return "";
  if (!initial) return surname;
  return surname ? `${surname} ${initial}.` : `${initial}.`;
}

const categoryText: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};

/**
 * Live preview of the player's row on the scoreboard, updated as they type.
 * Purely visual: the fields already say everything, so the whole block is
 * `aria-hidden` and never announced.
 */
export function SignupBoardPreview({
  nome,
  cognome,
  categoria,
  className,
}: {
  nome: string;
  cognome: string;
  categoria: Categoria | "";
  className?: string;
}) {
  const name = boardName(nome, cognome);

  return (
    <div
      aria-hidden="true"
      data-slot="signup-board-preview"
      className={cn("flex flex-col gap-space-2", className)}
    >
      <p className="text-sm font-semibold text-foreground">
        Così comparirai sul tabellone
      </p>
      <div className="bg-primary text-primary-foreground">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-space-3 border-b border-neutral-600 px-space-3 py-space-2 text-sm font-semibold">
          <span>Pos.</span>
          <span>Giocatore</span>
          <span className="text-right">Tabellone</span>
        </div>
        <div
          data-testid="signup-board-row"
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-space-3 px-space-3 py-space-3"
        >
          <span className="font-mono text-lg tabular-nums">––</span>
          <span
            data-testid="signup-board-name"
            className={cn(
              "font-mono text-lg font-semibold wrap-anywhere",
              !name && "opacity-70",
            )}
          >
            {name || "COGNOME N."}
          </span>
          <span className="text-right font-heading text-xs font-semibold tracking-wider uppercase">
            {categoria ? categoryText[categoria] : "–"}
          </span>
        </div>
        <Tape size={4} />
      </div>
    </div>
  );
}
