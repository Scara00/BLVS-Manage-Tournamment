import type { Metadata } from "next";
import { SessionExpired } from "@/components/auth";

export const metadata: Metadata = {
  title: "Sessione scaduta",
  robots: { index: false },
};

export default function SessionExpiredPage() {
  return <SessionExpired />;
}
