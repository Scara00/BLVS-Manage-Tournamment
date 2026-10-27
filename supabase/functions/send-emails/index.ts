// Supabase Edge Function (Deno): sends the emails queued in
// public.coda_email. pg_cron calls it every minute through
// public.avvia_worker_email(); it can also be called by hand with
// `Authorization: Bearer $EMAIL_WORKER_SECRET`.
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";
import {
  processEmailQueue,
  resolveSmtpConfig,
  type EmailQueueStore,
  type QueuedEmail,
} from "../_shared/email-queue.ts";

const BATCH_SIZE = 20;

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Metodo non consentito", { status: 405 });
  }
  const secret = Deno.env.get("EMAIL_WORKER_SECRET");
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorizzato", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const store: EmailQueueStore = {
    async claimBatch(limit) {
      const { data, error } = await supabase.rpc("prendi_email_da_inviare", {
        quante: limit,
      });
      if (error) throw error;
      return (data ?? []) as QueuedEmail[];
    },
    async completeAttempt(id, { error, retryAt }) {
      const { error: rpcError } = await supabase.rpc("chiudi_tentativo_email", {
        p_email_id: id,
        p_errore: error,
        p_riprova_at: retryAt?.toISOString() ?? null,
      });
      if (rpcError) throw rpcError;
    },
  };

  try {
    const smtp = resolveSmtpConfig(Deno.env.toObject());
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    });
    const result = await processEmailQueue({
      store,
      now: () => new Date(),
      limit: BATCH_SIZE,
      transport: {
        async send(message) {
          await transporter.sendMail({ from: smtp.from, ...message });
        },
      },
    });
    return Response.json({ ...result, mode: smtp.mode });
  } catch (error) {
    console.error("[email] worker interrotto", error);
    return Response.json({ error: "Errore del worker email" }, { status: 500 });
  }
});
