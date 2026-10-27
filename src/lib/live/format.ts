import { formatServerTime } from "@/lib/time/server-time";

/** «HH:MM» in Europe/Rome, the same on server and client (no hydration drift). */
export function formatLiveTime(iso: string): string {
  return formatServerTime(new Date(iso), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
