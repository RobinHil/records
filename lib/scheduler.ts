import cron from "node-cron";
import { runSync } from "@/lib/sync";

declare global {
  var __syncSchedulerStarted: boolean | undefined;
}

// Daily Discogs sync, scheduled inside the Next.js server process itself.
// Started once from instrumentation.ts when the server boots.
export function startScheduler() {
  if (globalThis.__syncSchedulerStarted) return;
  globalThis.__syncSchedulerStarted = true;

  const expression = process.env.SYNC_CRON || "0 4 * * *";
  if (!cron.validate(expression)) {
    console.error(`[scheduler] Invalid SYNC_CRON "${expression}", not scheduling.`);
    return;
  }
  cron.schedule(expression, async () => {
    console.log("[scheduler] Starting daily Discogs sync");
    try {
      const result = await runSync();
      console.log("[scheduler] Sync done:", JSON.stringify(result));
    } catch (e) {
      console.error("[scheduler] Sync failed:", e);
    }
  });
  console.log(`[scheduler] Daily Discogs sync scheduled (${expression})`);
}
