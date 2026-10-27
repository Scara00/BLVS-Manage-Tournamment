import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/lib/auth/actions";

export default function PlayerLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell variant="player" signOut={signOut}>
      {children}
    </AppShell>
  );
}
