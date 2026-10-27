"use client";

import { useSearchParams } from "next/navigation";
import { signupReturnPath } from "@/lib/auth/paths";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
import { SignupForm } from "./signup-form";

/** The form, sending the user back to `?da=` once signed in. Needs Suspense. */
export function SignupFormFromParams() {
  const params = useSearchParams();
  return <SignupForm returnTo={signupReturnPath(params?.get(RETURN_PARAM))} />;
}
