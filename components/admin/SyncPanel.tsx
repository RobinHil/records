"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { SyncLogDTO, SyncStatus } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LogLine({ log }: { log: SyncLogDTO }) {
  return (
    <li className="flex items-center gap-3 py-2 text-xs">
      {log.status === "success" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ink-soft" strokeWidth={1.75} aria-hidden />
      ) : log.status === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-ink" strokeWidth={1.75} aria-hidden />
      ) : (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-muted" strokeWidth={1.75} aria-hidden />
      )}
      <span className="tabular-nums text-ink-muted">{formatDate(log.startedAt)}</span>
      {log.status === "error" ? (
        <span className="truncate text-ink-soft">{log.error ?? "Failed"}</span>
      ) : (
        <span className="text-ink-soft">
          {log.added} added, {log.updated} updated, {log.archived} archived
          {log.restored > 0 ? `, ${log.restored} restored` : ""}
        </span>
      )}
    </li>
  );
}

export default function SyncPanel({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      if (res.ok) {
        const data = (await res.json()) as SyncStatus;
        setStatus(data);
        if (data.running) setSyncing(true);
      }
    } catch {
      // transient
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // While a sync runs, poll so the panel updates even if the sync was
  // triggered elsewhere (daily cron).
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [syncing, refresh]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Sync failed");
      onSynced();
    } catch {
      setError("Network error during sync");
    } finally {
      setSyncing(false);
      refresh();
    }
  }

  const last = status?.lastSync ?? null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-ink">Discogs synchronization</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {last
              ? `Last sync ${formatDate(last.finishedAt ?? last.startedAt)} - ${
                  last.status === "success"
                    ? `${last.total} records, ${last.added} added, ${last.updated} updated, ${last.archived} archived${last.restored > 0 ? `, ${last.restored} restored` : ""}`
                    : `failed: ${last.error ?? "unknown error"}`
                }`
              : "Never synced yet. Runs automatically once a day."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
        >
          <History className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          History
        </button>

        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          )}
          {syncing ? "Syncing" : "Sync now"}
        </button>
      </div>

      {syncing && (
        <p className="mt-3 text-xs text-ink-muted">
          Fetching your Discogs collection. This can take a few minutes on the
          first run (covers and tracklists are throttled to respect API limits).
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-ink">
          <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          {error}
        </p>
      )}

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-4 divide-y divide-line/70 border-t border-line pt-2">
              {(status?.logs ?? []).length === 0 && (
                <li className="py-2 text-xs text-ink-muted">No syncs yet.</li>
              )}
              {(status?.logs ?? []).map((log) => (
                <LogLine key={log.id} log={log} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
