"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { now } from "@/lib/time/server-time";
import {
  FLUSH_DRAFTS_EVENT,
  readDraft,
  removeDraft,
  restoreForm,
  saveDraft,
  serializeForm,
} from "./drafts";

const SAVE_DELAY_MS = 500;

/**
 * Keeps a local draft of `formRef`'s values while the user types, and puts
 * them back on the next visit. Pending changes are written at once on
 * `flushDrafts()` and on `pagehide`. Call `clear()` once the form was sent. The
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
    // Time of the last change not written yet, not of the delayed write.
    let changedAt: string | null = null;
    const write = () => {
      clearTimeout(timer);
      if (changedAt === null) return;
      saveDraft({
        id,
        label,
        path,
        savedAt: changedAt,
        values: serializeForm(form),
      });
      changedAt = null;
    };
    const save = () => {
      changedAt = now().toISOString();
      clearTimeout(timer);
      timer = setTimeout(write, SAVE_DELAY_MS);
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    // Session about to close, or the page is going away: write at once.
    window.addEventListener(FLUSH_DRAFTS_EVENT, write);
    window.addEventListener("pagehide", write);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
      window.removeEventListener(FLUSH_DRAFTS_EVENT, write);
      window.removeEventListener("pagehide", write);
    };
  }, [formRef, id, label, path]);

  const clear = useCallback(() => {
    removeDraft(id);
    setRestoredAt(null);
  }, [id]);

  return { restoredAt, clear };
}
