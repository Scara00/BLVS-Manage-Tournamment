"use client";

import { useSearchParams } from "next/navigation";
import { ResetPasswordFlow } from "@/components/password-reset";

/** Reads `?token_hash=` from the reset email link. */
export function ResetPasswordPage() {
  const params = useSearchParams();
  return <ResetPasswordFlow tokenHash={params?.get("token_hash") || null} />;
}
