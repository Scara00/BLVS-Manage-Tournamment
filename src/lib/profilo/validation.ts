import { BodyReader } from "@/lib/api/validation";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import {
  PROFILO_MESSAGES,
  type CampoProfilo,
  type StatoCategoria,
} from "./types";

export type ProfiloInput = {
  nome: string;
  cognome: string;
  email: string;
  /** `undefined` when the form has no category control (it is locked). */
  categoria: Categoria | undefined;
};

export type ProfiloValidation =
  | { ok: true; values: ProfiloInput }
  | { ok: false; fields: Partial<Record<CampoProfilo, string>> };

/**
 * Validates the profile form. The category may only differ from the saved
 * one while `statoCategoria` is `modificabile`; the database trigger
 * `utenti_blocca_categoria` enforces the same rule.
 */
export function validaProfilo(
  formData: FormData,
  {
    categoriaAttuale,
    statoCategoria,
  }: { categoriaAttuale: Categoria | null; statoCategoria: StatoCategoria },
): ProfiloValidation {
  const body: Record<string, unknown> = {};
  for (const campo of ["nome", "cognome", "email", "categoria"]) {
    const value = formData.get(campo);
    if (typeof value === "string") body[campo] = value;
  }

  const reader = new BodyReader(body);
  const nome = reader.text("nome", { max: 100 });
  const cognome = reader.text("cognome", { max: 100 });
  const email = reader.email("email");
  const categoria = reader.oneOf("categoria", CATEGORIE, {
    required: categoriaAttuale !== null && statoCategoria === "modificabile",
  });

  if (
    categoria !== undefined &&
    categoria !== categoriaAttuale &&
    statoCategoria !== "modificabile"
  ) {
    reader.errors.categoria = PROFILO_MESSAGES.categoria[statoCategoria];
  }

  if (!reader.ok) return { ok: false, fields: reader.errors };
  return {
    ok: true,
    values: { nome: nome!, cognome: cognome!, email: email!, categoria },
  };
}
