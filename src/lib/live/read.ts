import "server-only";
import { connection } from "next/server";
import { now } from "@/lib/time/server-time";
import { getLiveBus } from "./bus";
import type { LiveSync } from "./types";

/** Current live state for a server render, read at request time. */
export async function readLiveSync(): Promise<LiveSync> {
  await connection();
  return { snapshot: getLiveBus().snapshot(), syncedAt: now().toISOString() };
}
