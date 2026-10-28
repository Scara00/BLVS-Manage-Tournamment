"use client";

import { SearchIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FiltriGiocatori } from "@/lib/giocatori/admin/filtri";
import { GIOCATORI_ADMIN_PATH } from "@/lib/giocatori/admin/paths";

/**
 * Search and «da verificare» filter of w-admin-giocatori. A GET form: the
 * filters live in the URL (`?q=…&verifica=1`), so a filtered list can be
 * reloaded or shared, and the server reads the first page again.
 */
export function FiltriGiocatori({ filtri }: { filtri: FiltriGiocatori }) {
  const attivi = filtri.q !== "" || filtri.daVerificare;
  return (
    <Form
      action={GIOCATORI_ADMIN_PATH}
      role="search"
      aria-label="Cerca giocatori"
      className="flex flex-col gap-space-4 border-2 border-neutral-200 p-inset md:flex-row md:flex-wrap md:items-end"
    >
      <Field
        label="Cerca"
        hint="Nome, cognome o email: almeno 2 caratteri."
        className="min-w-0 md:flex-1"
      >
        <Input
          type="search"
          name="q"
          defaultValue={filtri.q}
          autoComplete="off"
          maxLength={100}
        />
      </Field>
      <Checkbox
        name="verifica"
        value="1"
        defaultChecked={filtri.daVerificare}
        label="Solo categoria da verificare"
        className="md:pb-space-3"
      />
      <div className="flex flex-wrap gap-space-3">
        <Button type="submit" className="max-w-full">
          <SearchIcon aria-hidden className="size-4" />
          Cerca
        </Button>
        {attivi ? (
          <Link
            href={GIOCATORI_ADMIN_PATH}
            className={buttonVariants({
              variant: "secondary",
              className: "max-w-full",
            })}
          >
            Azzera i filtri
          </Link>
        ) : null}
      </div>
    </Form>
  );
}
