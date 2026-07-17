"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ListRestart, Loader2, LogOut } from "lucide-react";
import RecordList from "@/components/admin/RecordList";
import SyncPanel from "@/components/admin/SyncPanel";
import type { RecordDTO } from "@/lib/types";

const RESET_OPTIONS = [
  { value: "album", label: "Album A-Z" },
  { value: "artist", label: "Artist A-Z" },
  { value: "year", label: "Release year" },
] as const;

export default function AdminDashboard() {
  const router = useRouter();
  const [records, setRecords] = useState<RecordDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetChoice, setResetChoice] = useState<
    (typeof RESET_OPTIONS)[number] | null
  >(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/records");
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items ?? []);
      }
    } catch {
      // transient
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  function handleReorder(orderedIds: number[]) {
    // Optimistic: reflect the new order immediately, persist in background.
    setRecords((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      const active = orderedIds
        .map((id) => byId.get(id))
        .filter(Boolean) as RecordDTO[];
      const archived = prev.filter((r) => r.archived);
      return [...active, ...archived];
    });
    fetch("/api/records/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    }).catch(() => load());
  }

  function handleToggleFavorite(record: RecordDTO) {
    const next = !record.isFavorite;
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, isFavorite: next } : r))
    );
    fetch(`/api/records/${record.id}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: next }),
    }).catch(() => load());
  }

  async function confirmReset() {
    if (!resetChoice) return;
    setResetting(true);
    try {
      await fetch("/api/records/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basedOn: resetChoice.value }),
      });
      await load();
    } finally {
      setResetting(false);
      setResetChoice(null);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.35em] text-ink">
            Records
          </h1>
          <p className="mt-0.5 text-xs text-ink-muted">Collection admin</p>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            View gallery
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Sign out
          </button>
        </nav>
      </header>

      <SyncPanel onSynced={load} />

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-ink">Collection</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Drag to define your custom order. Stars mark favorites. Both are
              local only and survive syncs.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ListRestart className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden />
            <span className="text-xs text-ink-muted">Reset order from:</span>
            {RESET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setResetChoice(opt)}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
            Loading collection
          </div>
        ) : records.length === 0 ? (
          <p className="py-16 text-center text-xs text-ink-muted">
            No records yet. Run your first sync above.
          </p>
        ) : (
          <RecordList
            records={records}
            onReorder={handleReorder}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </section>

      <AnimatePresence>
        {resetChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-6 backdrop-blur-md"
            onClick={() => !resetting && setResetChoice(null)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-[0_40px_100px_-32px_rgba(19,19,22,0.4)]"
            >
              <h3 className="text-sm font-medium text-ink">
                Reset custom order?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Your current manual order will be replaced with the automatic
                sort &ldquo;{resetChoice.label}&rdquo; as a new starting point.
                This cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => setResetChoice(null)}
                  className="rounded-full border border-line px-4 py-2 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={confirmReset}
                  className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {resetting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                  )}
                  Reset order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
