import { MinimalShell } from "@/components/layout/minimal-shell";

/** The player is not «in» the app yet: no navigation, only «Indietro». */
export default function ConfermaEmailLayout({
  children,
}: LayoutProps<"/registrati/conferma-email">) {
  return <MinimalShell>{children}</MinimalShell>;
}
