import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GironiEditor, GironiEditorLoading } from "@/components/admin-gironi";
import { PageContainer } from "@/components/layout/page-container";
import { modificaGironi } from "@/lib/gironi/editor/actions";
import { readEditorGironi } from "@/lib/gironi/editor/read";

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
  return (
    <>
      <GironiEditor
        // A new board (or a reload after a conflict) starts fresh.
        key={`${editor.tappa.id}:${editor.categoria}`}
        editor={editor}
        modifica={modificaGironi}
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
