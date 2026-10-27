"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { now } from "@/lib/time/server-time";
import {
  readDraft,
  removeDraft,
  restoreForm,
  saveDraft,
  serializeForm,
} from "./drafts";

const SAVE_DELAY_MS = 500;

/**
 * Keeps a local draft of `formRef`'s values while the user types, and puts
 * them back on the next visit. Call `clear()` once the form was sent. The
 * page at `path` is where «Riprendi» on the expired-session page leads.
 */
export function useFormDraft(
  formRef: RefObject<HTMLFormElement | null>,
  { id, label, path }: { id: string; label: string; path: string },
) {
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const existing = readDraft(id);
    if (existing) {
      restoreForm(form, existing.values);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with localStorage, an external store
      setRestoredAt(existing.savedAt);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      // Time of the change, not of the delayed write.
      const changedAt = now().toISOString();
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveDraft({
          id,
          label,
          path,
          savedAt: changedAt,
          values: serializeForm(form),
        });
      }, SAVE_DELAY_MS);
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [formRef, id, label, path]);

  const clear = useCallback(() => {
    removeDraft(id);
    setRestoredAt(null);
  }, [id]);

  return { restoredAt, clear };
}
