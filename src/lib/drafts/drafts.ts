/**
 * Local drafts of forms, kept in this browser's localStorage so a form
 * filled in when the session expires is not lost. They never reach the
 * server and never include passwords, hidden or file fields. Every storage
 * access is guarded: private windows and blocked storage just mean «no
 * drafts».
 */

const PREFIX = "blvs:bozza:";

/**
 * Window event that asks every mounted `useFormDraft` to write its pending
 * changes now, skipping the typing delay (e.g. right before the session
 * closes and the page is left).
 */
export const FLUSH_DRAFTS_EVENT = "blvs:salva-bozze";

/** Writes every pending draft on this page immediately. */
export function flushDrafts(): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(FLUSH_DRAFTS_EVENT));
}

export type DraftValues = Record<string, string | string[]>;

export type Draft = {
  /** Stable id of the form, e.g. `iscrizione-tappa-3`. */
  id: string;
  /** What the user calls it: «Iscrizione alla tappa di Rimini». */
  label: string;
  /** Internal path of the page holding the form, to resume it. */
  path: string;
  /** ISO time of the last change. */
  savedAt: string;
  values: DraftValues;
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.label === "string" &&
    typeof d.path === "string" &&
    d.path.startsWith("/") &&
    !d.path.startsWith("//") &&
    typeof d.savedAt === "string" &&
    !!d.values &&
    typeof d.values === "object"
  );
}

export function saveDraft(draft: Draft): boolean {
  try {
    storage()?.setItem(PREFIX + draft.id, JSON.stringify(draft));
    return storage() !== null;
  } catch {
    return false;
  }
}

export function readDraft(id: string): Draft | null {
  try {
    const raw = storage()?.getItem(PREFIX + id);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function removeDraft(id: string): void {
  try {
    storage()?.removeItem(PREFIX + id);
  } catch {
    // Storage unavailable: nothing to remove.
  }
}

/** Every valid draft, most recent first. */
export function listDrafts(): Draft[] {
  const store = storage();
  if (!store) return [];
  const drafts: Draft[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const draft = readDraft(key.slice(PREFIX.length));
      if (draft) drafts.push(draft);
    }
  } catch {
    return [];
  }
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Removes every draft (after «Esci», on a possibly shared device). */
export function clearDrafts(): number {
  const drafts = listDrafts();
  drafts.forEach((draft) => removeDraft(draft.id));
  return drafts.length;
}

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Controls that may be kept in a draft: no secrets, no hidden state. */
function draftable(control: Element): control is FormControl {
  if (!(
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
  ))
    return false;
  if (!control.name || control.closest("[data-no-draft]")) return false;
  if (control instanceof HTMLInputElement)
    return ![
      "password",
      "hidden",
      "file",
      "submit",
      "button",
      "reset",
    ].includes(control.type);
  return true;
}

/** The form's current values, without passwords, hidden and file fields. */
export function serializeForm(form: HTMLFormElement): DraftValues {
  const values: DraftValues = {};
  for (const control of Array.from(form.elements)) {
    if (!draftable(control)) continue;
    const { name } = control;
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      const list = (values[name] as string[] | undefined) ?? [];
      if (control.checked) list.push(control.value);
      values[name] = list;
    } else if (
      control instanceof HTMLInputElement &&
      control.type === "radio"
    ) {
      if (control.checked) values[name] = control.value;
    } else if (control instanceof HTMLSelectElement && control.multiple) {
      values[name] = Array.from(control.selectedOptions, (o) => o.value);
    } else {
      values[name] = control.value;
    }
  }
  return values;
}

/** Puts `values` back into the form's controls. */
export function restoreForm(form: HTMLFormElement, values: DraftValues): void {
  for (const control of Array.from(form.elements)) {
    if (!draftable(control) || !(control.name in values)) continue;
    const value = values[control.name];
    const list = Array.isArray(value) ? value : [value];
    if (
      control instanceof HTMLInputElement &&
      (control.type === "checkbox" || control.type === "radio")
    ) {
      control.checked = list.includes(control.value);
    } else if (control instanceof HTMLSelectElement && control.multiple) {
      Array.from(control.options).forEach((o) => {
        o.selected = list.includes(o.value);
      });
    } else {
      control.value = list[0] ?? "";
    }
  }
}
