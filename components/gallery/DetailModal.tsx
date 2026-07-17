"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Disc, Disc3, ExternalLink, X } from "lucide-react";
import CoverArt from "@/components/gallery/CoverArt";
import type { RecordDTO } from "@/lib/types";

function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-8 border-b border-line/70 py-2.5">
      <dt className="shrink-0 text-xs uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </dt>
      <dd className="text-right text-sm text-ink-soft">{value}</dd>
    </div>
  );
}

export default function DetailModal({
  record,
  onClose,
}: {
  record: RecordDTO | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!record) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [record, onClose]);

  const FormatIcon = record?.format === "CD" ? Disc : Disc3;

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-canvas/60 p-6 backdrop-blur-lg backdrop-saturate-150"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${record.title} by ${record.artist}`}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.88)] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_40px_120px_-32px_rgba(19,19,22,0.45)] backdrop-blur-2xl backdrop-saturate-150 md:p-12"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 rounded-full p-2 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>

            <div className="grid gap-10 md:grid-cols-[minmax(0,380px)_1fr] md:gap-14">
              <div className="mx-auto w-full max-w-sm md:mx-0">
                <CoverArt record={record} />
              </div>

              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-ink-muted">
                  <FormatIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  <span className="text-xs uppercase tracking-[0.2em]">
                    {record.format === "CD"
                      ? "Compact Disc"
                      : record.format === "VINYL"
                        ? "Vinyl"
                        : "Other format"}
                  </span>
                </div>

                <h2 className="text-3xl font-semibold tracking-tight text-ink">
                  {record.title}
                </h2>
                <p className="mt-1 text-lg text-ink-soft">{record.artist}</p>

                {(record.genres.length > 0 || record.styles.length > 0) && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {[...record.genres, ...record.styles].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/70 bg-white/40 px-3 py-1 text-xs text-ink-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <dl className="mt-6">
                  <MetaRow
                    label="Year"
                    value={record.year ? String(record.year) : null}
                  />
                  <MetaRow label="Label" value={record.label} />
                  <MetaRow label="Catalog no." value={record.catalogNumber} />
                  <MetaRow label="Country" value={record.country} />
                  <MetaRow label="Edition" value={record.formatDetail} />
                </dl>

                {record.discogsUrl && (
                  <a
                    href={record.discogsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-xs text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
                  >
                    View on Discogs
                    <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                  </a>
                )}
              </div>
            </div>

            {record.tracklist && record.tracklist.length > 0 && (
              <div className="mt-10 border-t border-line pt-8">
                <h3 className="mb-4 text-xs uppercase tracking-[0.2em] text-ink-muted">
                  Tracklist
                </h3>
                <ol className="grid gap-x-12 gap-y-1 md:grid-cols-2">
                  {record.tracklist.map((track, i) => (
                    <li
                      key={`${track.position}-${i}`}
                      className="flex items-baseline gap-4 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/50"
                    >
                      <span className="w-8 shrink-0 tabular-nums text-xs text-ink-muted">
                        {track.position || i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-soft">
                        {track.title}
                      </span>
                      {track.duration && (
                        <span className="shrink-0 tabular-nums text-xs text-ink-muted">
                          {track.duration}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
