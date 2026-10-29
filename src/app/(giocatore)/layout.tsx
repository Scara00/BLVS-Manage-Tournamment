import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PlayerNav } from "@/components/layout/player-nav";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";

export default function PlayerLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      variant="player"
      signOut={signOut}
      nav={
        // Everyone gets the player nav at once; an admin (who may also
        // play) then gets the way back to the admin area too.
        <Suspense fallback={<PlayerNav signOut={signOut} />}>
          <PlayerNavPerRuolo />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function PlayerNavPerRuolo() {
  // A failed check never breaks the page: the nav stays the player one.
  const user = await getCurrentUser().catch(() => null);
  return <PlayerNav signOut={signOut} admin={user?.ruolo === "admin"} />;
}
