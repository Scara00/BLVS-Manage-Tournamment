/**
 * Email queue worker logic, shared by the `send-emails` Edge Function (Deno)
 * and the Vitest suite (Node). Keep it free of imports and runtime globals:
 * the database, the SMTP transport and the clock are passed in.
 */

/** A row of `public.email_outbox` as returned by `claim_email_batch()`. */
export type QueuedEmail = {
  id: string;
  destinatario: string;
  oggetto: string;
  html: string;
  testo: string;
  /** Attempts so far, including the one that is about to run. */
  tentativi: number;
  max_tentativi: number;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailQueueStore {
  /** Locks up to `limit` due emails and counts a new attempt on each. */
  claimBatch(limit: number): Promise<QueuedEmail[]>;
  /**
   * Records the outcome of the current attempt: sent (`error` null), retry
   * later (`retryAt` set) or given up (`retryAt` null).
   */
  completeAttempt(
    id: string,
    outcome: { error: string | null; retryAt: Date | null },
  ): Promise<void>;
}

export type EmailQueueLogger = Pick<Console, "info" | "error">;

export type EmailQueueResult = {
  sent: number;
  retrying: number;
  failed: number;
};

const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 60 * 60_000;

/**
 * Wait before the next attempt after `failedAttempts` failures:
 * 1, 2, 4, 8 … minutes, capped at one hour.
 */
export function retryDelayMs(failedAttempts: number): number {
  const exponent = Math.max(0, failedAttempts - 1);
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Keep the log row readable; SMTP errors can carry whole transcripts.
  return message.slice(0, 1000) || "Errore sconosciuto";
}

/**
 * Sends one batch of due emails. Every failed attempt is recorded with its
 * error; an email is retried with exponential backoff until `max_tentativi`,
 * then marked failed.
 */
export async function processEmailQueue({
  store,
  transport,
  now,
  limit = 20,
  log = console,
}: {
  store: EmailQueueStore;
  transport: EmailTransport;
  now: () => Date;
  limit?: number;
  log?: EmailQueueLogger;
}): Promise<EmailQueueResult> {
  const result: EmailQueueResult = { sent: 0, retrying: 0, failed: 0 };
  const batch = await store.claimBatch(limit);

  for (const email of batch) {
    try {
      await transport.send({
        to: email.destinatario,
        subject: email.oggetto,
        html: email.html,
        text: email.testo,
      });
    } catch (error) {
      const message = describeError(error);
      const giveUp = email.tentativi >= email.max_tentativi;
      const retryAt = giveUp
        ? null
        : new Date(now().getTime() + retryDelayMs(email.tentativi));
      await store.completeAttempt(email.id, { error: message, retryAt });
      if (giveUp) {
        result.failed++;
        log.error(
          `[email] invio fallito definitivamente (${email.id}, tentativo ${email.tentativi}/${email.max_tentativi}): ${message}`,
        );
      } else {
        result.retrying++;
        log.error(
          `[email] invio fallito (${email.id}, tentativo ${email.tentativi}/${email.max_tentativi}), nuovo tentativo alle ${retryAt?.toISOString()}: ${message}`,
        );
      }
      continue;
    }
    await store.completeAttempt(email.id, { error: null, retryAt: null });
    result.sent++;
  }

  if (batch.length > 0) {
    log.info(
      `[email] coda: ${result.sent} inviate, ${result.retrying} da ritentare, ${result.failed} fallite`,
    );
  }
  return result;
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
  /** "mailpit" in development and CI: nothing leaves the machine. */
  mode: "mailpit" | "live";
};

const DEFAULT_FROM = "BLVS <noreply@blvs.local>";

/**
 * SMTP settings for the worker. Real delivery happens only when
 * `EMAIL_DELIVERY=live` is set explicitly (production secrets); anything
 * else, including a missing variable, goes to Mailpit, which catches every
 * message whatever the recipient.
 */
export function resolveSmtpConfig(
  env: Record<string, string | undefined>,
): SmtpConfig {
  if (env.EMAIL_DELIVERY === "live") {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
      throw new Error(
        "EMAIL_DELIVERY=live richiede SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ed EMAIL_FROM.",
      );
    }
    const port = Number(SMTP_PORT);
    return {
      host: SMTP_HOST,
      port,
      // Supabase Edge Functions block outbound 25 and 587: use 465 (TLS).
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      from: EMAIL_FROM,
      mode: "live",
    };
  }
  return {
    host: env.MAILPIT_SMTP_HOST || "localhost",
    port: Number(env.MAILPIT_SMTP_PORT || 1025),
    secure: false,
    from: env.EMAIL_FROM || DEFAULT_FROM,
    mode: "mailpit",
  };
}
