/**
 * Reads the emails caught by Mailpit (the SMTP sink of `supabase start`, or
 * `docker run axllent/mailpit`) through its REST API, so e2e tests can follow
 * the links in confirmation, password-reset and queue emails.
 * https://mailpit.axllent.org/docs/api-v1/
 */

/** Mailpit web/API address: 54324 is the port `supabase start` uses. */
export const MAILPIT_URL = (
  process.env.MAILPIT_URL ?? "http://127.0.0.1:54324"
).replace(/\/$/, "");

type MailpitSummary = {
  ID: string;
  Created: string;
  Subject: string;
  To: Array<{ Address: string }>;
};

export type MailpitMessage = {
  ID: string;
  Subject: string;
  HTML: string;
  Text: string;
  To: Array<{ Address: string }>;
  Created: string;
};

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  if (!response.ok) {
    throw new Error(
      `Mailpit ${init?.method ?? "GET"} ${path}: ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

/** Whether Mailpit answers at MAILPIT_URL (specs skip themselves if not). */
export async function isMailpitAvailable(): Promise<boolean> {
  try {
    await mailpit("/info");
    return true;
  } catch {
    return false;
  }
}

/** Deletes every message, or only those sent to `address`. */
export async function clearMailpit(address?: string): Promise<void> {
  if (!address) {
    await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
    return;
  }
  const query = new URLSearchParams({ query: `to:"${address}"` });
  await fetch(`${MAILPIT_URL}/api/v1/search?${query}`, { method: "DELETE" });
}

/**
 * The most recent message sent to `address`, waiting for it to arrive.
 * `after` ignores older messages (e.g. from an earlier step of the test).
 */
export async function waitForLatestEmail(
  address: string,
  { after, timeout = 15_000 }: { after?: Date; timeout?: number } = {},
): Promise<MailpitMessage> {
  const query = new URLSearchParams({ query: `to:"${address}"`, limit: "1" });
  const deadline = Date.now() + timeout;
  for (;;) {
    const { messages } = await mailpit<{ messages: MailpitSummary[] }>(
      `/search?${query}`,
    );
    const latest = messages[0];
    if (latest && (!after || new Date(latest.Created) >= after)) {
      return mailpit<MailpitMessage>(`/message/${latest.ID}`);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Nessuna email per ${address} su Mailpit entro ${timeout} ms`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/** Every http(s) link of a message, in order: HTML hrefs, else the text. */
export function extractLinks(message: Pick<MailpitMessage, "HTML" | "Text">) {
  const fromHtml = [...message.HTML.matchAll(/href="(https?:[^"]+)"/g)].map(
    (m) =>
      m[1].replace(/&(amp|quot|#x27|#39|lt|gt);/g, (e) => HTML_ENTITIES[e]),
  );
  if (fromHtml.length > 0) return [...new Set(fromHtml)];
  return [...new Set(message.Text.match(/https?:\/\/[^\s<>"]+/g) ?? [])];
}

/**
 * The link of the latest email received by `address`, e.g. the confirmation
 * or password-reset URL. `match` picks a specific link when there are many.
 */
export async function getLatestLink(
  address: string,
  options: { after?: Date; timeout?: number; match?: RegExp } = {},
): Promise<string> {
  const message = await waitForLatestEmail(address, options);
  const links = extractLinks(message);
  const link = options.match
    ? links.find((l) => options.match!.test(l))
    : links[0];
  if (!link) {
    throw new Error(
      `L'email «${message.Subject}» per ${address} non contiene link${options.match ? ` che corrispondono a ${options.match}` : ""}`,
    );
  }
  return link;
}
