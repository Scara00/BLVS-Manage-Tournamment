import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveLoading,
  LiveMatches,
  LiveProvider,
} from "@/components/live";
import { buttonVariants } from "@/components/ui/button";
import { readLiveSync } from "@/lib/live/read";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { liveTappaHref, TAPPE_PATH } from "@/lib/tappe/paths";
import { readTappe } from "@/lib/tappe/read";

export const metadata: Metadata = { title: "Live" };

/** Without Supabase env (CI, e2e): the demo stage on the live channel. */
async function LiveContent() {
  const initial = await readLiveSync();
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer types={["score", "group-standings", "phase-started"]} />
        <LiveMatches />
      </div>
    </LiveProvider>
  );
}

/** With Supabase: w-live of the stage in progress, or a note when none is. */
async function LiveTappaInCorso() {
  const inCorso = (await readTappe()).find((t) => t.stato === "in_corso");
  if (inCorso) redirect(liveTappaHref(inCorso.id));
  return (
    <div className="flex flex-col items-start gap-stack-sm">
      <p className="max-w-prose">
        Nessuna tappa in corso: le partite compaiono qui quando comincia la
        prossima tappa.
      </p>
      <Link
        href={TAPPE_PATH}
        className={buttonVariants({ variant: "secondary" })}
      >
        Vai alle tappe
      </Link>
    </div>
  );
}

export default function LivePage() {
  const demo = !readSupabaseEnv();
  return (
    <PageContainer
      title="Live"
      eyebrow={demo ? "Tappa 1 · Jesolo" : undefined}
      description="Le partite in corso, campo per campo."
    >
      <Suspense fallback={<LiveLoading what="delle partite" />}>
        {demo ? <LiveContent /> : <LiveTappaInCorso />}
      </Suspense>
    </PageContainer>
  );
}
