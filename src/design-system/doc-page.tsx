import type { ReactNode } from "react";

/** Shell shared by the design-system documentation stories. */
export function DocPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-space-7 p-inset">
      <header className="flex flex-col gap-stack-sm border-b-4 border-tape pb-space-5">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Design system BLVS Court
        </p>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="max-w-prose text-pretty text-muted-foreground">{intro}</p>
      </header>
      {children}
    </main>
  );
}

export function DocSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-stack">
      <div className="flex flex-col gap-space-1">
        <h2 id={id} className="font-heading text-2xl font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
