"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useState } from "react";
import { initialSignInState, type SignInState } from "@/lib/auth/sign-in-state";
import {
  initialSignOutState,
  type SignOutState,
} from "@/lib/auth/sign-out-state";
import { clearDrafts } from "@/lib/drafts/drafts";
import {
  describeReturnPath,
  REASON_PARAM,
  safeAfterLoginPath,
  SIGNED_OUT_PARAM,
} from "@/lib/navigation/auth-paths";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
import { LoginFormView, type LoginNotice } from "./login-form-view";

export type SignInAction = (
  prevState: SignInState,
  formData: FormData,
) => Promise<SignInState>;

export type SignOutFormAction = (
  prevState: SignOutState,
  formData: FormData,
) => Promise<SignOutState>;

type LoginFormProps = { signIn: SignInAction; signOut: SignOutFormAction };

function LoginFormFromParams({ signIn, signOut }: LoginFormProps) {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState(
    signIn,
    initialSignInState,
  );
  const [, signOutAction] = useActionState(signOut, initialSignOutState);
  const returnTo = safeAfterLoginPath(params?.get(RETURN_PARAM));
  const reason = params?.get(REASON_PARAM);
  const signedOut = params?.get(SIGNED_OUT_PARAM) === "1";
  const [draftsCleared, setDraftsCleared] = useState(0);

  // «Esci» on a possibly shared device: local drafts go too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store
    if (signedOut) setDraftsCleared(clearDrafts());
  }, [signedOut]);

  const notice: LoginNotice = signedOut
    ? { kind: "uscita", draftsCleared }
    : reason === "scaduta"
      ? { kind: "scaduta", destination: describeReturnPath(returnTo) }
      : null;

  return (
    <LoginFormView
      state={state}
      formAction={formAction}
      pending={pending}
      returnTo={returnTo}
      notice={notice}
      signOutAction={signOutAction}
    />
  );
}

/**
 * The login form, reading `?da=`, `?uscita=` and `?motivo=` on the client.
 * The Suspense fallback keeps the page shell static (Cache Components); it
 * is not a form, so nothing can be submitted before hydration.
 */
export function LoginForm(props: LoginFormProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-lg px-inset py-space-6 md:py-space-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Accedi
          </h1>
          <p role="status" className="pt-space-4">
            Caricamento del modulo di accesso…
          </p>
        </div>
      }
    >
      <LoginFormFromParams {...props} />
    </Suspense>
  );
}
