export { cn } from "cn";

/** Joins ARIA id references (aria-describedby, …), skipping empty ones. */
export function mergeIds(...ids: (string | false | null | undefined)[]) {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}
