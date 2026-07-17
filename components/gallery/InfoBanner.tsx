"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { RecordDTO } from "@/lib/types";

// Floating pill at the bottom center of the viewport showing the essentials
// of the hovered record - deliberately off the artwork itself.
export default function InfoBanner({ record }: { record: RecordDTO | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-40 flex justify-center px-6">
      <AnimatePresence mode="wait">
        {record && (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="flex max-w-full items-baseline gap-3 rounded-full border border-white/60 bg-[var(--glass)] px-6 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_40px_-12px_rgba(19,19,22,0.3)] backdrop-blur-xl backdrop-saturate-150"
          >
            <span className="truncate text-sm font-medium tracking-tight text-ink">
              {record.title}
            </span>
            <span className="shrink-0 text-ink-muted" aria-hidden>
              &mdash;
            </span>
            <span className="truncate text-sm text-ink-soft">{record.artist}</span>
            {record.year && (
              <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                {record.year}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
