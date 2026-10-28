import { PRIVACY_POLICY_VERSION } from "@/lib/legal/privacy-policy";
import type { ConsensoPrivacy } from "@/lib/impostazioni/types";

/**
 * BLVS-53 demo (no Supabase env): the demo player «Luca Rossi»
 * (`DEMO_ME_CLASSIFICA`), as on the other demo player pages.
 */
export const DEMO_IMPOSTAZIONI = {
  nome: "Luca",
  cognome: "Rossi",
  email: "luca.rossi@blvs.test",
} as const;

export const DEMO_CONSENSO: ConsensoPrivacy = {
  versione: PRIVACY_POLICY_VERSION.number,
  dataInformativa: PRIVACY_POLICY_VERSION.date,
  accettatoIl: "2026-10-27T16:42:00.000Z",
};

/** The current password the demo accepts. */
export const DEMO_PASSWORD_ATTUALE = "Password-attuale-1";

/**
 * Set by a demo deletion: this browser is «signed out» and its settings
 * pages show «Sessione scaduta». Per browser, so e2e tests stay isolated.
 */
export const DEMO_ACCOUNT_CANCELLATO_COOKIE = "blvs_demo_account_cancellato";
