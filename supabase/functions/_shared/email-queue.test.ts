// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  processEmailQueue,
  resolveSmtpConfig,
  retryDelayMs,
  type EmailMessage,
  type EmailQueueStore,
  type QueuedEmail,
} from "./email-queue";

const NOW = new Date("2026-10-27T10:00:00.000Z");

/**
 * In-memory stand-in for public.email_outbox + email_attempts that mirrors
 * the SQL functions: claim counts an attempt, complete records the outcome.
 */
function createMemoryStore(rows: Array<Partial<QueuedEmail> & { id: string }>) {
  const emails = new Map(
    rows.map((row) => [
      row.id,
      {
        email: {
          destinatario: "giocatore@example.test",
          oggetto: "Oggetto",
          html: "<p>Ciao</p>",
          testo: "Ciao",
          tentativi: 0,
          max_tentativi: 3,
          ...row,
        } satisfies QueuedEmail,
        status: "pending" as "pending" | "sending" | "sent" | "failed",
        dueAt: NOW,
        lastError: null as string | null,
      },
    ]),
  );
  const attempts: Array<{ id: string; attempt: number; error: string | null }> =
    [];

  const store: EmailQueueStore = {
    async claimBatch(limit) {
      const due = [...emails.values()]
        .filter((e) => e.status === "pending" && e.dueAt <= clock.now)
        .slice(0, limit);
      for (const e of due) {
        e.status = "sending";
        e.email = { ...e.email, tentativi: e.email.tentativi + 1 };
      }
      return due.map((e) => e.email);
    },
    async completeAttempt(id, { error, retryAt }) {
      const e = emails.get(id)!;
      attempts.push({ id, attempt: e.email.tentativi, error });
      e.lastError = error;
      if (error === null) e.status = "sent";
      else if (retryAt === null) e.status = "failed";
      else {
        e.status = "pending";
        e.dueAt = retryAt;
      }
    },
  };
  const clock = { now: NOW };
  return { store, emails, attempts, clock };
}

function failingTransport(failures: number) {
  const sent: EmailMessage[] = [];
  let calls = 0;
  return {
    sent,
    send: vi.fn(async (message: EmailMessage) => {
      calls++;
      if (calls <= failures) throw new Error(`SMTP 451 tentativo ${calls}`);
      sent.push(message);
    }),
  };
}

const silent = { info: vi.fn(), error: vi.fn() };

describe("retryDelayMs", () => {
  it("raddoppia l'attesa a ogni errore, fino a un'ora", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([
      60_000, 120_000, 240_000, 480_000, 960_000,
    ]);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });
});

describe("processEmailQueue", () => {
  it("invia le email in coda e le segna come inviate", async () => {
    const { store, emails, attempts } = createMemoryStore([{ id: "a" }]);
    const transport = failingTransport(0);

    const result = await processEmailQueue({
      store,
      transport,
      now: () => NOW,
      log: silent,
    });

    expect(result).toEqual({ sent: 1, retrying: 0, failed: 0 });
    expect(transport.sent).toEqual([
      {
        to: "giocatore@example.test",
        subject: "Oggetto",
        html: "<p>Ciao</p>",
        text: "Ciao",
      },
    ]);
    expect(emails.get("a")!.status).toBe("sent");
    expect(attempts).toEqual([{ id: "a", attempt: 1, error: null }]);
  });

  it("ritenta dopo un errore con attesa crescente e registra ogni errore", async () => {
    const { store, emails, attempts, clock } = createMemoryStore([
      { id: "a", max_tentativi: 5 },
    ]);
    const transport = failingTransport(2);
    const run = () =>
      processEmailQueue({
        store,
        transport,
        now: () => clock.now,
        log: silent,
      });

    expect(await run()).toEqual({ sent: 0, retrying: 1, failed: 0 });
    expect(emails.get("a")!.dueAt).toEqual(new Date(NOW.getTime() + 60_000));

    // Not due yet: nothing is sent before the backoff expires.
    expect(await run()).toEqual({ sent: 0, retrying: 0, failed: 0 });

    clock.now = emails.get("a")!.dueAt;
    expect(await run()).toEqual({ sent: 0, retrying: 1, failed: 0 });
    expect(emails.get("a")!.dueAt).toEqual(
      new Date(clock.now.getTime() + 120_000),
    );

    clock.now = emails.get("a")!.dueAt;
    expect(await run()).toEqual({ sent: 1, retrying: 0, failed: 0 });

    expect(emails.get("a")!.status).toBe("sent");
    expect(attempts).toEqual([
      { id: "a", attempt: 1, error: "SMTP 451 tentativo 1" },
      { id: "a", attempt: 2, error: "SMTP 451 tentativo 2" },
      { id: "a", attempt: 3, error: null },
    ]);
    expect(silent.error).toHaveBeenCalledWith(
      expect.stringContaining("SMTP 451 tentativo 1"),
    );
  });

  it("si arrende dopo il numero massimo di tentativi", async () => {
    const { store, emails, attempts, clock } = createMemoryStore([
      { id: "a", max_tentativi: 3 },
    ]);
    const transport = failingTransport(Infinity);
    const log = { info: vi.fn(), error: vi.fn() };

    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(
        await processEmailQueue({
          store,
          transport,
          now: () => clock.now,
          log,
        }),
      );
      clock.now = emails.get("a")!.dueAt;
    }

    expect(outcomes.at(-1)).toEqual({ sent: 0, retrying: 0, failed: 1 });
    expect(emails.get("a")!.status).toBe("failed");
    expect(emails.get("a")!.lastError).toBe("SMTP 451 tentativo 3");
    expect(attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(log.error).toHaveBeenLastCalledWith(
      expect.stringContaining("fallito definitivamente"),
    );

    // A failed email is never picked up again.
    clock.now = new Date(NOW.getTime() + 24 * 3_600_000);
    expect(
      await processEmailQueue({ store, transport, now: () => clock.now, log }),
    ).toEqual({ sent: 0, retrying: 0, failed: 0 });
  });

  it("un errore su un'email non blocca le altre del lotto", async () => {
    const { store, emails } = createMemoryStore([{ id: "a" }, { id: "b" }]);
    const transport = failingTransport(1);

    const result = await processEmailQueue({
      store,
      transport,
      now: () => NOW,
      log: silent,
    });

    expect(result).toEqual({ sent: 1, retrying: 1, failed: 0 });
    expect(emails.get("a")!.status).toBe("pending");
    expect(emails.get("b")!.status).toBe("sent");
  });
});

describe("resolveSmtpConfig", () => {
  it("senza EMAIL_DELIVERY=live usa sempre Mailpit, anche con un SMTP reale configurato", () => {
    const config = resolveSmtpConfig({
      SMTP_HOST: "smtp.provider.example",
      SMTP_PORT: "465",
      SMTP_USER: "utente",
      SMTP_PASS: "segreto",
      MAILPIT_SMTP_HOST: "supabase_inbucket_blvs",
    });
    expect(config).toMatchObject({
      mode: "mailpit",
      host: "supabase_inbucket_blvs",
      port: 1025,
      secure: false,
    });
    expect(config.auth).toBeUndefined();
  });

  it("con EMAIL_DELIVERY=live usa l'SMTP configurato", () => {
    expect(
      resolveSmtpConfig({
        EMAIL_DELIVERY: "live",
        SMTP_HOST: "smtp.provider.example",
        SMTP_PORT: "465",
        SMTP_USER: "utente",
        SMTP_PASS: "segreto",
        EMAIL_FROM: "BLVS <noreply@blvs.it>",
      }),
    ).toEqual({
      mode: "live",
      host: "smtp.provider.example",
      port: 465,
      secure: true,
      auth: { user: "utente", pass: "segreto" },
      from: "BLVS <noreply@blvs.it>",
    });
  });

  it("con EMAIL_DELIVERY=live e configurazione incompleta non parte", () => {
    expect(() =>
      resolveSmtpConfig({ EMAIL_DELIVERY: "live", SMTP_HOST: "smtp.x" }),
    ).toThrow(/SMTP_PORT/);
  });
});
