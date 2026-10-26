export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <section
        aria-labelledby="home-title"
        className="flex w-full max-w-2xl flex-col items-center gap-6 text-center"
      >
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Gestione tornei
        </p>
        <h1
          id="home-title"
          className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
        >
          BLVS – Manage Tournament
        </h1>
        <p className="max-w-prose text-lg text-pretty text-muted-foreground">
          Organizza tornei, squadre, calendari e risultati in un unico posto.
        </p>
      </section>
    </main>
  );
}
