import {
  formatServerTime,
  getProcessTimeZone,
  SERVER_TIME_ZONE,
} from "@/lib/time/server-time";

/** Runs once when a server instance starts. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const processTimeZone = getProcessTimeZone();
  if (processTimeZone !== SERVER_TIME_ZONE) {
    console.warn(
      `[server-time] il processo gira sul fuso ${processTimeZone}, non ${SERVER_TIME_ZONE}: usa sempre @/lib/time/server-time per l'orario del server.`,
    );
  }
  console.info(
    `[server-time] avvio server: ${formatServerTime()} (${SERVER_TIME_ZONE})`,
  );
}
