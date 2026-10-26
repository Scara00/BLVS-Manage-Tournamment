import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLVS – Manage Tournament",
  description:
    "Gestisci tornei, squadre, calendari e risultati in un unico posto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={cn(fontVariables, "h-full antialiased")}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
