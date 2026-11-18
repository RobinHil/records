"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import type { RecordDTO } from "@/lib/types";

/*
 * Choix de la pochette d'un emplacement de l'affiche.
 *
 * Toutes les pochettes lisibles sont proposees, dans l'ordre des couleurs,
 * y compris celles que la selection a ecartees : choisir une pochette est un
 * geste explicite, il passe outre les filtres. Celles deja sur l'affiche sont
 * signalees, puisque les choisir les fait changer de place avec l'occupant.
 */

export interface PickerCover {
  record: RecordDTO;
  onPoster: boolean;
  hidden: boolean;
}

export default function CoverPicker({
  slot,
  covers,
  onPick,
  onClose,
}: {
  /** L'occupant actuel de l'emplacement, ou null quand la modale est fermee. */
  slot: RecordDTO | null;
  covers: PickerCover[];
  onPick: (record: RecordDTO) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!slot) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slot, onClose]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return covers;
    return covers.filter((c) => c.record.searchText.includes(needle));
  }, [covers, query]);

  return (
    <AnimatePresence onExitComplete={() => setQuery("")}>
      {slot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/60 p-4 backdrop-blur-lg backdrop-saturate-150 sm:p-6 print:hidden"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a cover"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-3xl flex-col rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_40px_120px_-32px_rgba(19,19,22,0.45)] backdrop-blur-2xl"
          >
            <div className="flex items-start gap-4 border-b border-line p-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">
                  Choose a cover
                </h2>
                <p className="mt-1 truncate text-xs text-ink-muted">
                  In place of {slot.title} - {slot.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search albums or artists"
                  className="h-10 w-full rounded-full border border-line bg-surface/70 pl-11 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-surface"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {shown.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">No cover matches.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {shown.map(({ record, onPoster, hidden }) => {
                    const current = record.instanceId === slot.instanceId;
                    return (
                      <button
                        key={record.instanceId}
                        type="button"
                        onClick={() => onPick(record)}
                        title={`${record.title} - ${record.artist}${
                          current
                            ? "\nIn this spot"
                            : onPoster
                              ? "\nOn the poster: the two will swap"
                              : hidden
                                ? "\nHidden: it comes back here"
                                : ""
                        }`}
                        className={`relative aspect-square overflow-hidden rounded-[2px] ring-offset-2 ring-offset-white transition-transform hover:scale-[1.04] ${
                          current ? "ring-2 ring-ink" : "ring-1 ring-black/10"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={record.coverSrc as string}
                          alt={`${record.title} - ${record.artist}`}
                          loading="lazy"
                          className={`h-full w-full object-cover ${
                            onPoster || current ? "" : "opacity-60"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="border-t border-line px-5 py-3 text-[11px] text-ink-muted">
              Faded covers are not on the poster: picking one brings it in and takes this
              one out. Picking a cover already on it swaps the two.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
