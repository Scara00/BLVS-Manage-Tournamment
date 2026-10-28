import type { Metadata } from "next";
import { AccountCancellato } from "@/components/impostazioni";

export const metadata: Metadata = { title: "Account cancellato" };

/** w-account-eliminato (BLVS-53): public, the account no longer exists. */
export default function AccountCancellatoPage() {
  return <AccountCancellato />;
}
