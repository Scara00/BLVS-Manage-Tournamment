import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Home } from "@/lib/home/types";
import { saluto } from "@/lib/home/vista";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { HomeGara, type HomeGaraProps } from "./home-gara";
import { HomeHeader } from "./home-header";
import { HomeProssima, HomeVuota } from "./home-prossima";

/**
 * w-home (BLVS-52): the player's home. The race day shows my match, place
 * and group with the live bar; other days the next stage, or the empty
 * state. `gara` passes story/test options to the race-day view.
 */
export function HomeGiocatore({
  home,
  gara,
}: {
  home: Home;
  gara?: Omit<HomeGaraProps, "saluto" | "dati">;
}) {
  if (home.status === "sessionExpired") return <HomeSessioneScaduta />;
  const testo = saluto(home.nome);
  const { vista } = home;
  if (vista.tipo === "gara") {
    return <HomeGara saluto={testo} dati={vista} {...gara} />;
  }
  return (
    <div className="flex flex-col gap-stack-lg">
      <HomeHeader saluto={testo} />
      {vista.tipo === "prossima" ? <HomeProssima {...vista} /> : <HomeVuota />}
    </div>
  );
}

/** Suspense fallback while the home is read. */
export function HomeLoading() {
  return (
    <div className="flex flex-col gap-stack-lg" aria-busy="true">
      <HomeHeader saluto="Ciao" />
      <p className="text-muted-foreground">Caricamento della tua home…</p>
    </div>
  );
}

/** Shown when the session has expired. */
export function HomeSessioneScaduta() {
  return (
    <div className="flex flex-col gap-stack-lg">
      <HomeHeader saluto="Ciao" />
      <section
        aria-labelledby="home-sessione-titolo"
        className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
      >
        <h2
          id="home-sessione-titolo"
          className="flex items-start gap-space-2 font-heading text-xl font-semibold"
        >
          <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
          Sessione scaduta
        </h2>
        <p>
          Accedi di nuovo per vedere la tua prossima tappa e la tua partita.
        </p>
        <Link
          href={sessionExpiredHref("/")}
          className={buttonVariants({
            variant: "primary",
            className: "max-w-full",
          })}
        >
          Accedi di nuovo
        </Link>
      </section>
    </div>
  );
}
