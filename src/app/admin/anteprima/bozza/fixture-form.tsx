"use client";

import { useRef } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormDraft } from "@/lib/drafts/use-form-draft";

/**
 * Dev/e2e only: an admin form with a local draft, to show that extending
 * the session keeps what is typed and that expiry keeps it as a draft
 * (BLVS-18). Real admin forms adopt `useFormDraft` the same way.
 */
export function DraftFixtureForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { restoredAt } = useFormDraft(formRef, {
    id: "anteprima-admin-tappa",
    label: "Anteprima · Nuova tappa",
    path: "/admin/anteprima/bozza",
  });

  return (
    <form
      ref={formRef}
      className="flex max-w-md flex-col gap-stack"
      onSubmit={(event) => event.preventDefault()}
    >
      <Field label="Nome della tappa">
        <Input name="nome" autoComplete="off" />
      </Field>
      <Field label="Località">
        <Input name="localita" autoComplete="off" />
      </Field>
      {restoredAt ? (
        <p role="status">Bozza ripristinata da questo dispositivo.</p>
      ) : null}
    </form>
  );
}
