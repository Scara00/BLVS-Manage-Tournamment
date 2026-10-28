import { Suspense } from "react";
import { HomeGiocatore, HomeLoading } from "@/components/home";
import { readHome } from "@/lib/home/read";

async function HomeContent() {
  return <HomeGiocatore home={await readHome()} />;
}

/**
 * w-home (BLVS-52): on the race day my match, place and group with the
 * live bar; on other days the next stage and my registration, or the
 * empty state. The page title stays the app's default.
 */
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-frame flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-7">
      <Suspense fallback={<HomeLoading />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}
