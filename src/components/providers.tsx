"use client";

import { ToastProvider, Toaster } from "@/components/ui/toast";

/** Client-side providers for the whole app, mounted by the root layout. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
