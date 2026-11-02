import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BLVS – Manage Tournament", template: "%s · BLVS" },
  description:
    "Gestisci tornei, squadre, calendari e risultati in un unico posto.",
  // Label under the icon on the iOS home screen. `capable: false` keeps the
  // shortcut opening in Safari (Next would otherwise add web-app-capable).
  appleWebApp: { title: "BLVS", capable: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={cn(fontVariables, "h-full antialiased")}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
