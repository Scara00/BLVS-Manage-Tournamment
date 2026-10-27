import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDrafts,
  flushDrafts,
  listDrafts,
  readDraft,
  restoreForm,
  saveDraft,
  serializeForm,
  type Draft,
} from "./drafts";
import { useFormDraft } from "./use-form-draft";

const draft = (id: string, savedAt: string): Draft => ({
  id,
  label: `Modulo ${id}`,
  path: `/tappe/${id}`,
  savedAt,
  values: { nome: id },
});

function formHtml() {
  const form = document.createElement("form");
  form.innerHTML = `
    <input name="nome" value="Rimini" />
    <input name="password" type="password" value="segreta" />
    <input name="token" type="hidden" value="t" />
    <input name="categoria" type="radio" value="m" />
    <input name="categoria" type="radio" value="f" checked />
    <input name="extra" type="checkbox" value="a" checked />
    <input name="extra" type="checkbox" value="b" />
    <select name="tappa"><option value="1">1</option><option value="2" selected>2</option></select>
    <textarea name="note">Ciao</textarea>
    <div data-no-draft><input name="codice" value="x" /></div>`;
  return form;
}

beforeEach(() => localStorage.clear());

describe("bozze locali", () => {
  it("salva, rilegge ed elenca dalla più recente", () => {
    saveDraft(draft("a", "2026-10-27T10:00:00.000Z"));
    saveDraft(draft("b", "2026-10-27T11:00:00.000Z"));
    localStorage.setItem("altro", "{}");
    localStorage.setItem("blvs:bozza:rotta", "non json");
    expect(readDraft("a")?.label).toBe("Modulo a");
    expect(listDrafts().map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("scarta bozze con un percorso esterno", () => {
    localStorage.setItem(
      "blvs:bozza:x",
      JSON.stringify({ ...draft("x", "2026"), path: "//evil.example" }),
    );
    expect(listDrafts()).toEqual([]);
  });

  it("clearDrafts elimina solo le bozze", () => {
    saveDraft(draft("a", "2026"));
    localStorage.setItem("altro", "1");
    expect(clearDrafts()).toBe(1);
    expect(localStorage.getItem("altro")).toBe("1");
  });

  it("con lo storage bloccato non salva e non elenca nulla", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });
    expect(saveDraft(draft("a", "2026"))).toBe(false);
    spy.mockRestore();
    expect(listDrafts()).toEqual([]);
  });

  it("non salva mai password, campi nascosti o esclusi", () => {
    const values = serializeForm(formHtml());
    expect(values).toEqual({
      nome: "Rimini",
      categoria: "f",
      extra: ["a"],
      tappa: "2",
      note: "Ciao",
    });
  });

  it("rimette i valori nel modulo", () => {
    const form = formHtml();
    restoreForm(form, {
      nome: "Pescara",
      categoria: "m",
      extra: ["b"],
      tappa: "1",
    });
    expect(serializeForm(form)).toMatchObject({
      nome: "Pescara",
      categoria: "m",
      extra: ["b"],
      tappa: "1",
    });
  });
});

function DraftForm({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useFormDraft>) => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const api = useFormDraft(ref, {
    id: "prova",
    label: "Prova",
    path: "/tappe",
  });
  onReady(api);
  return (
    <form ref={ref}>
      <input name="nome" aria-label="Nome" defaultValue="" />
      <input name="password" type="password" aria-label="Password" />
    </form>
  );
}

describe("useFormDraft", () => {
  afterEach(() => vi.useRealTimers());

  it("salva mentre si scrive e ripristina alla visita successiva", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    let api!: ReturnType<typeof useFormDraft>;
    const first = render(<DraftForm onReady={(a) => (api = a)} />);
    const nome = first.getByLabelText("Nome") as HTMLInputElement;
    const password = first.getByLabelText("Password") as HTMLInputElement;
    nome.value = "Mario";
    password.value = "segreta";
    nome.dispatchEvent(new Event("input", { bubbles: true }));
    act(() => vi.advanceTimersByTime(600));
    expect(readDraft("prova")).toMatchObject({
      path: "/tappe",
      savedAt: "2026-10-27T12:00:00.000Z",
      values: { nome: "Mario" },
    });
    expect(JSON.stringify(readDraft("prova"))).not.toContain("segreta");
    first.unmount();

    const second = render(<DraftForm onReady={(a) => (api = a)} />);
    expect((second.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Mario",
    );
    expect(api.restoredAt).toBe("2026-10-27T12:00:00.000Z");
    act(() => api.clear());
    expect(readDraft("prova")).toBeNull();
  });

  it("flushDrafts salva subito le modifiche in sospeso, senza aspettare", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const view = render(<DraftForm onReady={() => {}} />);
    const nome = view.getByLabelText("Nome") as HTMLInputElement;
    nome.value = "Giulia";
    nome.dispatchEvent(new Event("input", { bubbles: true }));
    expect(readDraft("prova")).toBeNull();

    act(() => flushDrafts());
    expect(readDraft("prova")?.values).toEqual({ nome: "Giulia" });

    // Nothing pending: the timer does not write again.
    localStorage.clear();
    act(() => vi.advanceTimersByTime(600));
    expect(readDraft("prova")).toBeNull();
  });

  it("salva anche quando la pagina viene lasciata (pagehide)", () => {
    vi.useFakeTimers();
    const view = render(<DraftForm onReady={() => {}} />);
    const nome = view.getByLabelText("Nome") as HTMLInputElement;
    nome.value = "Luca";
    nome.dispatchEvent(new Event("input", { bubbles: true }));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(readDraft("prova")?.values).toEqual({ nome: "Luca" });
  });
});
