import { MinimalShell } from "@/components/layout/minimal-shell";

export default function LoginLayout({ children }: LayoutProps<"/accesso">) {
  return <MinimalShell back={false}>{children}</MinimalShell>;
}
