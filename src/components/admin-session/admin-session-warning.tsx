"use client";

import { LogOutIcon, TimerIcon } from "lucide-react";
import { useActionState, useRef, type MouseEvent } from "react";
import type { SignOutAction } from "@/components/layout/sign-out-button";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogAction } from "@/components/ui/dialog";
import {
  describeCountdown,
  formatCountdown,
} from "@/lib/admin/session-timeout";
import { initialSignOutState } from "@/lib/auth/sign-out-state";
import { ADMIN_SESSION_MESSAGES as M, countdownMilestone } from "./messages";

export type AdminSessionWarningProps = {
  open: boolean;
  secondsLeft: number;
  /** The deadline passed: drafts are being saved, the page is being left. */
  expired?: boolean;
  /** The extension request is in flight. */
  pending?: boolean;
  /** Why the last extension failed. */
  error?: string | null;
  /** «Prolunga sessione», and also Esc: the admin is clearly there. */
  onExtend: () => void;
  /** Server action behind «Esci». */
  signOut: SignOutAction;
};

/**
 * The alertdialog shown before the admin session closes. «Prolunga
 * sessione» gets the focus; Esc extends too. The countdown is visual only
 * (`aria-hidden`); screen readers get it in words in the description, read
 * when the dialog opens, and a polite note at one minute and 30 seconds.
 */
export function AdminSessionWarning({
  open,
  secondsLeft,
  expired = false,
  pending = false,
  error = null,
  onExtend,
  signOut,
}: AdminSessionWarningProps) {
  const extendRef = useRef<HTMLButtonElement>(null);
  const [signOutState, signOutAction, signingOut] = useActionState(
    signOut,
    initialSignOutState,
  );

  function onSignOutClick(event: MouseEvent<HTMLButtonElement>) {
    if (signingOut) event.preventDefault();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending && !expired) onExtend();
      }}
    >
      <AlertDialogContent
        data-slot="admin-session-warning"
        initialFocus={() => extendRef.current ?? true}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {expired ? M.expiredTitle : M.title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {expired ? (
              M.expiring
            ) : (
              <>
                {M.intro}{" "}
                <span className="sr-only">
                  {describeCountdown(secondsLeft)}.
                </span>
                <span aria-hidden className="font-semibold">
                  {formatCountdown(secondsLeft)}.
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody className="flex flex-col gap-space-3">
          {expired ? null : (
            <p
              aria-hidden
              data-testid="admin-session-countdown"
              className="flex items-center gap-space-2 self-start border-l-4 border-warning-fg bg-warning-bg px-space-3 py-space-2 font-mono text-3xl font-semibold text-warning-fg tabular-nums"
            >
              <TimerIcon className="size-6" />
              {formatCountdown(secondsLeft)}
            </p>
          )}
          <p>{M.saved}</p>
          {expired ? null : <p className="text-sm">{M.signOutNote}</p>}
          <p role="status" className="sr-only">
            {expired ? "" : countdownMilestone(secondsLeft)}
          </p>
          {error ? (
            <p role="alert" className="font-semibold text-error-fg">
              {error}
            </p>
          ) : null}
          {signOutState.error ? (
            <p role="alert" className="font-semibold text-error-fg">
              {signOutState.error}
            </p>
          ) : null}
        </AlertDialogBody>
        {expired ? null : (
          <AlertDialogFooter>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="secondary"
                aria-disabled={signingOut || undefined}
                onClick={onSignOutClick}
                className="w-full sm:w-auto"
              >
                <LogOutIcon aria-hidden />
                {M.signOut}
              </Button>
            </form>
            <DialogAction
              ref={extendRef}
              loading={pending}
              loadingText={M.extending}
              onClick={() => {
                if (!pending) onExtend();
              }}
            >
              {M.extend}
            </DialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
