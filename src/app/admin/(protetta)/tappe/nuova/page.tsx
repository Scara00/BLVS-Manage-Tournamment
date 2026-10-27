import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Suspense } from "react";
import {
  NuovaTappaForm,
  NuovaTappaLoading,
  NuovaTappaSessioneScaduta,
} from "@/components/admin-tappe";
import { PageContainer } from "@/components/layout/page-container";
import { getCurrentUser } from "@/lib/auth/session";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { creaTappa } from "@/lib/tappe/nuova/actions";

export const metadata: Metadata = { title: "Nuova tappa · Amministrazione" };

async function NuovaTappaContent() {
  // Without Supabase env (CI, e2e) the form still validates; saving answers
  // «non disponibile».
  if (readSupabaseEnv()) {
    const user = await getCurrentUser();
    if (!user) return <NuovaTappaSessioneScaduta />;
    if (user.ruolo !== "admin") forbidden();
  }
  return <NuovaTappaForm action={creaTappa} />;
}

export default function NuovaTappaPage() {
  return (
    <PageContainer
      title="Nuova tappa"
      eyebrow="Tappe"
      description="Crea una tappa in bozza: potrai aprire le iscrizioni in un secondo momento."
    >
      <Suspense fallback={<NuovaTappaLoading />}>
        <NuovaTappaContent />
      </Suspense>
    </PageContainer>
  );
}
