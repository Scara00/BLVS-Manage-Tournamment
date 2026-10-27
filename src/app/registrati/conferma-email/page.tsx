import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  EmailVerifyScreen,
  type EmailVerifyScreenProps,
} from "@/components/email-verify";
import { readOutcome } from "@/lib/auth/email-verification/constants";
import {
  linkExpiresAt,
  resendWaitSeconds,
} from "@/lib/auth/email-verification/format";
import { readPendingVerification } from "@/lib/auth/email-verification/pending";
import { readReturnAfterConfirmation } from "@/lib/auth/email-verification/return-path";
import { getCurrentUser } from "@/lib/auth/session";
import { now } from "@/lib/time/server-time";

export const metadata: Metadata = { title: "Conferma email" };

/**
 * w-email-verify (BLVS-15), step 2 of 3 of the registration. The shell is
 * static; the state depends on cookies, so it streams inside Suspense.
 */
export default function ConfermaEmailPage({
  searchParams,
}: PageProps<"/registrati/conferma-email">) {
  return (
    <Suspense fallback={<EmailVerifyScreen status="loading" />}>
      <EmailVerifyState searchParams={searchParams} />
    </Suspense>
  );
}

async function EmailVerifyState({
  searchParams,
}: {
  searchParams: PageProps<"/registrati/conferma-email">["searchParams"];
}) {
  const [params, pending] = await Promise.all([
    searchParams,
    readPendingVerification(),
  ]);
  const returnTo = (await readReturnAfterConfirmation(params.da)) ?? undefined;
  return (
    <EmailVerifyScreen
      {...await resolveState(params.esito, pending)}
      returnTo={returnTo}
    />
  );
}

async function resolveState(
  esito: string | string[] | undefined,
  pending: Awaited<ReturnType<typeof readPendingVerification>>,
): Promise<EmailVerifyScreenProps> {
  const outcome = readOutcome(esito);
  const user = await getCurrentUser();
  // The lock and expiry depend on the clock: request time only, never in a
  // (runtime) prerender, where cookies are readable but `now()` is not.
  await connection();

  if (outcome === "confermata") {
    return { status: "success", email: user?.email };
  }
  const at = now();
  const waitSeconds = pending ? resendWaitSeconds(pending.inviataIl, at) : 0;
  if (outcome === "scaduto") {
    return { status: "sessionExpired", email: pending?.email, waitSeconds };
  }
  if (user && (await isConfirmed(user.supabase))) {
    return { status: "success", email: user.email };
  }
  // Signed in but not confirmed (e.g. sent here by «Prendi il posto»):
  // the address is known even without the pending cookie.
  if (!pending && user) return { status: "waiting", email: user.email };
  if (!pending) return { status: "permissionDenied" };
  return {
    status: "waiting",
    email: pending.email,
    expiresAt: linkExpiresAt(pending.inviataIl).toISOString(),
    waitSeconds,
  };
}

async function isConfirmed(
  supabase: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>["supabase"],
) {
  const { data, error } = await supabase.rpc("email_confermata");
  if (error)
    console.error("[auth] lettura della conferma email non riuscita", error);
  return data === true;
}
