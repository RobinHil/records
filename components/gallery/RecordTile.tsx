"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import CoverArt from "@/components/gallery/CoverArt";
import type { RecordDTO } from "@/lib/types";

export default function RecordTile({
  record,
  onHover,
  onSelect,
}: {
  record: RecordDTO;
  onHover: (record: RecordDTO | null) => void;
  onSelect: (record: RecordDTO) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [7, -7]), {
    stiffness: 260,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-7, 7]), {
    stiffness: 260,
    damping: 22,
  });

  function handleMouseMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function handleMouseLeave() {
    px.set(0.5);
    py.set(0.5);
    onHover(null);
  }

  return (
    <div style={{ perspective: 900 }} className="group">
      <motion.button
        ref={ref}
        type="button"
        aria-label={`${record.title} by ${record.artist}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => onHover(record)}
        onMouseLeave={handleMouseLeave}
        onFocus={() => onHover(record)}
        onBlur={() => onHover(null)}
        onClick={() => onSelect(record)}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={{ scale: 1.045 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="block w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
      >
        <CoverArt
          record={record}
          className="transition-shadow duration-300 group-hover:shadow-[0_4px_10px_rgba(19,19,22,0.16),0_28px_48px_-18px_rgba(19,19,22,0.45)]"
        />
      </motion.button>
    </div>
  );
}
