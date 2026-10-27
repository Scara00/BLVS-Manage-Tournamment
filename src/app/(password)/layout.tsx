import { MinimalShell } from "@/components/layout/minimal-shell";

/** Password screens: no navigation, only «Indietro» (to `?da=` or home). */
export default function PasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MinimalShell>{children}</MinimalShell>;
}
