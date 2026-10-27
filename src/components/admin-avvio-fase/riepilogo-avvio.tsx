import type { RiepilogoAvvio as Riepilogo } from "@/lib/tappe/avvio/regole";

const VOCI = [
  { chiave: "gironi", label: "Gironi" },
  { chiave: "giocatori", label: "Giocatori nei gironi" },
  { chiave: "partite", label: "Partite da creare" },
] as const;

/** Groups, players and matches the start will create. */
export function RiepilogoAvvio({
  riepilogo,
  avviata = false,
}: {
  riepilogo: Riepilogo;
  avviata?: boolean;
}) {
  return (
    <dl
      aria-label="Riepilogo"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-stack-sm"
    >
      {VOCI.map(({ chiave, label }) => (
        <div
          key={chiave}
          className="flex flex-col gap-space-1 border-2 border-primary p-inset"
        >
          <dt className="font-heading text-sm font-semibold">
            {chiave === "partite" && avviata ? "Partite create" : label}
          </dt>
          <dd className="font-mono text-4xl font-semibold tabular-nums">
            {riepilogo[chiave]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
