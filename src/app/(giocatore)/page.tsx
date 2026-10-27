import Link from "next/link";
import { playerPrimaryNav } from "@/components/layout/nav-items";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-inset py-space-8">
      <section
        aria-labelledby="home-title"
        className="flex w-full max-w-2xl flex-col items-center gap-space-5 text-center"
      >
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Gestione tornei
        </p>
        <h1
          id="home-title"
          className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          BLVS – Manage Tournament
        </h1>
        <p className="max-w-prose text-lg text-pretty text-muted-foreground">
          Organizza tornei, squadre, calendari e risultati in un unico posto.
        </p>
        <ul className="flex flex-wrap justify-center gap-space-3">
          {playerPrimaryNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center border border-primary px-space-5 font-heading font-medium hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
