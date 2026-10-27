import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { SignupForm, SignupFormFromParams } from "@/components/signup";

export const metadata: Metadata = { title: "Registrati" };

export default function SignupPage() {
  return (
    <PageContainer
      title="Registrati"
      description="Crea il tuo account da giocatore: ti servirà per iscriverti alle tappe."
    >
      {/* `?da=` is read on the client so the shell stays static. */}
      <Suspense fallback={<SignupForm />}>
        <SignupFormFromParams />
      </Suspense>
    </PageContainer>
  );
}
