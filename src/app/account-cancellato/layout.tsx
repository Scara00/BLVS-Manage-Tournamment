import { MinimalShell } from "@/components/layout/minimal-shell";

export default function AccountCancellatoLayout({
  children,
}: LayoutProps<"/account-cancellato">) {
  return <MinimalShell back={false}>{children}</MinimalShell>;
}
