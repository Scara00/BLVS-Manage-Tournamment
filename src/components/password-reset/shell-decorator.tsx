import type { Decorator } from "@storybook/nextjs-vite";
import { MinimalShell } from "@/components/layout/minimal-shell";

/** Stories show the screen inside its real frame (MinimalShell). */
export const withPasswordShell: Decorator = (Story) => (
  <div className="flex min-h-screen flex-col">
    <MinimalShell>
      <Story />
    </MinimalShell>
  </div>
);

export const mobile = { viewport: { value: "mobile390", isRotated: false } };

export const LONG_EMAIL =
  "giocatrice.con.un.indirizzo.molto.lungo.per.provare.il.testo@associazione-sportiva-beach-volley-lungomare.example.it";
