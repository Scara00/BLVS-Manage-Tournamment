"use client";

import { useCallback } from "react";
import { ISCRITTI_MESSAGES } from "@/lib/iscrizioni/admin/messages";
import type { ModificaIscrittiAction } from "@/lib/iscrizioni/admin/types";

/**
 * The server action, with a lost connection (the action throws) turned
 * into the `network` error the UI already shows.
 */
export function useAzioneIscritti(
  action: ModificaIscrittiAction,
): ModificaIscrittiAction {
  return useCallback<ModificaIscrittiAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[iscritti] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: ISCRITTI_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
}
