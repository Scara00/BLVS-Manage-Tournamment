import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  GironiEditor,
  GironiEditorLoading,
  RigeneraGironi,
} from "@/components/admin-gironi";
import { PageContainer } from "@/components/layout/page-container";
import { ParitaGirone } from "@/components/admin-parita";
import { modificaGironi } from "@/lib/gironi/editor/actions";
import { readEditorGironi } from "@/lib/gironi/editor/read";
import { risolviParita } from "@/lib/gironi/parita/actions";
import { readParitaTabellone } from "@/lib/gironi/parita/read";
import { rigeneraGironi } from "@/lib/gironi/rigenera/actions";
import { readRigenerazione } from "@/lib/gironi/rigenera/read";

export const metadata: Metadata = { title: "Gironi · Amministrazione" };

/**
 * Cache Components needs at least one sample to prerender the shell (the
 * admin shell reads the pathname). Every other board renders on request.
 */
export function generateStaticParams() {
  return [{ id: "jesolo", categoria: "m" }];
}

async function EditorContent({
  id,
  categoria,
}: {
  id: string;
  categoria: string;
}) {
  const editor = await readEditorGironi(id, categoria);
  const [rigenerazione, parita] = await Promise.all([
    readRigenerazione(editor),
    readParitaTabellone(editor.tappa.id, editor.categoria),
  ]);
  // BLVS-38: a finished group with a perfect tie shows it in its card.
  const extraGironi = Object.fromEntries(
    parita
      .filter((g) => g.parita.length > 0)
      .map((g) => [
        g.gironeId,
        <ParitaGirone key={g.gironeId} girone={g} risolvi={risolviParita} />,
      ]),
  );
  return (
    <>
      <GironiEditor
        // A new board, or new groups after a regeneration (the version
        // grows), starts fresh.
        key={`${editor.tappa.id}:${editor.categoria}:${editor.composizione.versione}`}
        editor={editor}
        modifica={modificaGironi}
        extraGironi={extraGironi}
      />
      <RigeneraGironi
        key={`${editor.tappa.id}:${editor.categoria}`}
        rigenerazione={rigenerazione}
        rigenera={rigeneraGironi}
      />
      <Link
        href={`/admin/tappe/${encodeURIComponent(editor.tappa.id)}`}
        className="inline-flex items-center gap-space-2 self-start font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Torna alla tappa
      </Link>
    </>
  );
}

export default function GironiEditorPage({
  params,
}: PageProps<"/admin/tappe/[id]/gironi/[categoria]">) {
  return (
    <PageContainer
      title="Gironi"
      eyebrow="Amministrazione · Tappe"
      description="Sposta e scambia i giocatori, aggiungi o elimina gironi. Vale per i gironi Gold e Silver."
    >
      <Suspense fallback={<GironiEditorLoading />}>
        {params.then(({ id, categoria }) => (
          <div className="flex flex-col gap-stack-lg">
            <EditorContent
              id={decodeURIComponent(id)}
              categoria={decodeURIComponent(categoria)}
            />
          </div>
        ))}
      </Suspense>
    </PageContainer>
  );
}
