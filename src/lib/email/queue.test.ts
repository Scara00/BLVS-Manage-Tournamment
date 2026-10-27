// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { accodaEmail, ErroreCodaEmail } from "./queue";

function fakeClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

const props = {
  stageName: "Tappa di Rimini",
  startsAt: "2027-06-12T07:30:00.000Z",
  detailsUrl: "https://blvs.example/tappe/rimini",
};

describe("accodaEmail", () => {
  it("accoda l'email già resa (oggetto, HTML e testo)", async () => {
    const { client, from, insert } = fakeClient({
      data: { id: "e1" },
      error: null,
    });

    const result = await accodaEmail(client, {
      to: "giocatore@example.test",
      template: "tappa-annullata",
      props,
    });

    expect(result).toEqual({ id: "e1" });
    expect(from).toHaveBeenCalledWith("coda_email");
    expect(insert).toHaveBeenCalledWith({
      destinatario: "giocatore@example.test",
      modello: "tappa-annullata",
      oggetto: "Tappa annullata: Tappa di Rimini · BLVS",
      html: expect.stringContaining('lang="it"'),
      testo: expect.stringContaining("https://blvs.example/tappe/rimini"),
    });
  });

  it("passa il numero massimo di tentativi se indicato", async () => {
    const { client, insert } = fakeClient({ data: { id: "e2" }, error: null });
    await accodaEmail(client, {
      to: "g@example.test",
      template: "tappa-annullata",
      props,
      maxTentativi: 8,
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ max_tentativi: 8 }),
    );
  });

  it("registra l'errore e lancia ErroreCodaEmail se l'inserimento fallisce", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: { code: "42501" } });

    await expect(
      accodaEmail(client, {
        to: "g@example.test",
        template: "tappa-annullata",
        props,
      }),
    ).rejects.toBeInstanceOf(ErroreCodaEmail);
    expect(log).toHaveBeenCalledWith(
      "[email] accodamento non riuscito",
      "tappa-annullata",
      { code: "42501" },
    );
    log.mockRestore();
  });
});
