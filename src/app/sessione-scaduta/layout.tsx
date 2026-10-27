import { MinimalShell } from "@/components/layout/minimal-shell";

export default function SessionExpiredLayout({
  children,
}: LayoutProps<"/sessione-scaduta">) {
  return <MinimalShell back={false}>{children}</MinimalShell>;
}
