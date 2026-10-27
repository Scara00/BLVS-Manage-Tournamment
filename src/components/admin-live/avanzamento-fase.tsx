import {
  avanzamentoLabel,
  type Avanzamento,
} from "@/lib/tappe/live-admin/format";

/**
 * The phase's progress: «8 di 24 partite concluse» as text and as a bar,
 * then how many are to play, in progress and with a result to enter.
 */
export function AvanzamentoFase({
  avanzamento,
  faseLabel,
}: {
  avanzamento: Avanzamento;
  faseLabel: string;
}) {
  const label = avanzamentoLabel(avanzamento);
  const conteggi = [
    { label: "Da giocare", valore: avanzamento.daGiocare },
    { label: "In corso", valore: avanzamento.inCorso },
    { label: "Concluse", valore: avanzamento.concluse },
    { label: "Da inserire", valore: avanzamento.daInserire },
  ];
  return (
    <section
      aria-labelledby="avanzamento-titolo"
      className="flex flex-col gap-space-3 border-2 border-primary p-inset"
      data-testid="avanzamento-fase"
    >
      <div className="flex flex-col gap-space-1">
        <h2
          id="avanzamento-titolo"
          className="font-heading text-xl font-semibold"
        >
          Avanzamento della fase
        </h2>
        <p>Fase: {faseLabel}</p>
      </div>
      <p className="font-mono text-2xl font-semibold" data-testid="avanzamento">
        {label}
      </p>
      <div
        role="progressbar"
        aria-labelledby="avanzamento-titolo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={avanzamento.percentuale}
        aria-valuetext={`${label} (${avanzamento.percentuale}%)`}
        className="h-3 w-full bg-neutral-100"
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${avanzamento.percentuale}%` }}
        />
      </div>
      <dl className="grid grid-cols-2 gap-space-3 sm:grid-cols-4">
        {conteggi.map((c) => (
          <div key={c.label} className="flex flex-col">
            <dt className="text-sm">{c.label}</dt>
            <dd className="font-mono text-xl font-semibold">{c.valore}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
