"use client";

import { useSearchParams } from "next/navigation";
import { ForgotPasswordFlow } from "@/components/password-reset";
import { EXPIRED_LINK_REASON } from "@/lib/auth/password-reset/messages";

/** Reads `?motivo=link-scaduto` (from a dead reset link). */
export function ForgotPasswordPage() {
  const params = useSearchParams();
  return (
    <ForgotPasswordFlow
      linkExpired={params?.get("motivo") === EXPIRED_LINK_REASON}
    />
  );
}
