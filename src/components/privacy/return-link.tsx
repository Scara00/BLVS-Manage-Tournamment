"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  RETURN_PARAM,
  safeReturnPath,
} from "@/lib/navigation/safe-return-path";

type ReturnLinkProps = {
  className?: string;
  children: ReactNode;
};

function ReturnLinkFromParams({ className, children }: ReturnLinkProps) {
  const params = useSearchParams();
  const href = safeReturnPath(params?.get(RETURN_PARAM));
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * Link back to the page named by `?da=`, only when it is an internal path
 * (see `safeReturnPath`); otherwise to the home. The Suspense fallback keeps
 * the static shell prerenderable under Cache Components.
 */
export function ReturnLink(props: ReturnLinkProps) {
  return (
    <Suspense
      fallback={
        <Link href="/" className={props.className}>
          {props.children}
        </Link>
      }
    >
      <ReturnLinkFromParams {...props} />
    </Suspense>
  );
}
