import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordFlow } from "@/components/password-reset";
import { ForgotPasswordPage } from "./forgot-password-page";

export const metadata: Metadata = { title: "Password dimenticata" };

/** w-forgot → w-forgot-sent. The search params are read on the client. */
export default function Page() {
  return (
    <Suspense fallback={<ForgotPasswordFlow />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
