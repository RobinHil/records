"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

// Minimal popover: a trigger button and a floating frosted-glass panel that
// closes on outside click or Escape. The panel is portaled to <body>: an
// ancestor with backdrop-filter (the glass toolbar) forms a backdrop root,
// which would prevent the panel's own backdrop blur from sampling the page
// behind it.
export default function Popover({
  trigger,
  children,
  align = "left",
  onOpenChange,
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);

  useEffect(() => {
    onOpenChange?.(open);
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      if (align === "right") {
        setPos({
          top: rect.bottom + 8,
          right: Math.max(margin, window.innerWidth - rect.right),
        });
        return;
      }
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
    place();
    window.addEventListener("resize", place);
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, align, onOpenChange]);

  // The panel width is only measurable once it has mounted, so clamping into
  // the viewport happens here rather than in place(): this runs in the same
  // commit that renders the panel, before the browser paints.
  useLayoutEffect(() => {
    if (!open || !pos || pos.left === undefined) return;
    const margin = 8;
    const width = panelRef.current?.offsetWidth ?? 0;
    const clamped = Math.max(
      margin,
      Math.min(pos.left, window.innerWidth - width - margin)
    );
    if (clamped !== pos.left) setPos({ ...pos, left: clamped });
  }, [open, pos]);

  return (
    <div ref={rootRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                style={{ top: pos.top, left: pos.left, right: pos.right }}
                className="fixed z-50 min-w-52 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-white/60 bg-[var(--glass-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_50px_-16px_rgba(19,19,22,0.35)] backdrop-blur-2xl backdrop-saturate-150"
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
