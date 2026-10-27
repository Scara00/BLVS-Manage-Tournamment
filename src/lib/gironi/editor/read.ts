import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { getDemoGironi } from "@/lib/demo/gironi-editor";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { toComposizione, type GironiEditorJson } from "./format";
import {
  parseCategoriaSegmento,
  type ComposizioneGironi,
  type EditorGironi,
} from "./types";

/** The board id of a stage's category, or null when there is none. */
export async function readTabelloneId(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tabelloni")
    .select("id")
    .eq("tappa_id", tappaId)
    .eq("categoria", categoria)
    .maybeSingle();
  if (error) throw new Error(`tabellone: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function readComposizione(
  supabase: SupabaseClient,
  tabelloneId: string,
): Promise<ComposizioneGironi> {
  const { data, error } = await supabase.rpc("gironi_editor", {
    p_tabellone: tabelloneId,
  });
  if (error) throw new Error(`gironi_editor: ${error.message}`);
  return toComposizione(data as GironiEditorJson);
}

/**
 * w-admin-gironi: the groups of one board, read with the admin's session
 * (a player gets 403, an unknown stage or category 404). Without Supabase
 * env it reads the in-memory demo store.
 */
export async function readEditorGironi(
  tappaId: string,
  segmento: string,
): Promise<EditorGironi> {
  await connection();
  const categoria = parseCategoriaSegmento(segmento);
  if (!categoria) notFound();

  if (!readSupabaseEnv()) {
    const editor = getDemoGironi(tappaId, categoria);
    if (!editor) notFound();
    return editor;
  }

  if (!isUuid(tappaId)) notFound();
  const user = await getCurrentUser();
  if (user?.ruolo !== "admin") forbidden();
  const { supabase } = user;

  const { data: tappa, error } = await supabase
    .from("tappe")
    .select("id, nome")
    .eq("id", tappaId)
    .maybeSingle();
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!tappa) notFound();
  const tabelloneId = await readTabelloneId(supabase, tappaId, categoria);
  if (!tabelloneId) notFound();

  return {
    tappa: tappa as { id: string; nome: string },
    categoria,
    composizione: await readComposizione(supabase, tabelloneId),
  };
}
