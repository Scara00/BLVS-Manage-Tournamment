import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/lib/auth/actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell variant="admin" signOut={signOut}>
      {children}
    </AppShell>
  );
}
