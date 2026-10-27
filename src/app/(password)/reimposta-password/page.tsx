import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordFrame } from "@/components/password-reset";
import { ResetPasswordPage } from "./reset-password-page";

export const metadata: Metadata = { title: "Nuova password" };

/** w-reset: opened from the email link `?token_hash=…`. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <PasswordFrame title="Scegli una nuova password">
          <p role="status">Caricamento…</p>
        </PasswordFrame>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
