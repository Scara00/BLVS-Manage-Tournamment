import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/privacy/privacy-policy";

export const metadata: Metadata = { title: "Informativa privacy" };

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
