import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  EXPIRED_LINK_REASON,
  FORGOT_PASSWORD_PATH,
  RESET_LINK_VALIDITY_MINUTES,
} from "@/lib/auth/password-reset/messages";
import { PasswordFrame } from "./password-frame";

/** w-reset, sessionExpired: the link is expired, already used or broken. */
export function ResetLinkInvalid({
  focusHeading = false,
}: {
  focusHeading?: boolean;
}) {
  return (
    <PasswordFrame
      title="Link scaduto o già usato"
      focusHeading={focusHeading}
      description={
        <p>
          Il link per reimpostare la password vale {RESET_LINK_VALIDITY_MINUTES}{" "}
          minuti e si può usare una sola volta. Chiedine uno nuovo: arriva in
          pochi istanti.
        </p>
      }
    >
      <div>
        <Link
          href={`${FORGOT_PASSWORD_PATH}?motivo=${EXPIRED_LINK_REASON}`}
          className={buttonVariants()}
        >
          Chiedi un nuovo link
        </Link>
      </div>
    </PasswordFrame>
  );
}
