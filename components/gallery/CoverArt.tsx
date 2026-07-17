"use client";

import { Disc3 } from "lucide-react";
import type { RecordDTO } from "@/lib/types";

// Renders an album cover with a format-specific physical treatment:
// - Vinyl: the sleeve as-is, flat, paper-like.
// - CD: a minimalist crystal jewel case, clearly visible around the booklet -
//   translucent frame, hinged spine on the left, glass highlights and depth.
export default function CoverArt({
  record,
  sizes,
  className = "",
}: {
  record: RecordDTO;
  sizes?: string;
  className?: string;
}) {
  const isCD = record.format === "CD";

  const image = record.coverSrc ? (
    // Covers are cached locally by the sync; a plain img keeps the
    // virtualized grid cheap.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={record.coverSrc}
      alt={`${record.title} - ${record.artist}`}
      sizes={sizes}
      loading="lazy"
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-line/60 text-ink-muted">
      <Disc3 className="h-8 w-8" strokeWidth={1.25} aria-hidden />
    </div>
  );

  if (!isCD) {
    return (
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-[2px] bg-line/40 shadow-[0_1px_2px_rgba(19,19,22,0.10),0_12px_28px_-14px_rgba(19,19,22,0.35)] ring-1 ring-black/5 ${className}`}
      >
        {image}
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-[3px] shadow-[0_2px_4px_rgba(19,19,22,0.16),0_20px_38px_-16px_rgba(19,19,22,0.5)] ring-1 ring-black/20 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(233,236,239,0.85) 40%, rgba(203,208,214,0.9) 100%)",
      }}
    >
      {/* Booklet (the cover) sits inset inside the transparent case.
          The inset must stay square (width 83.5% = height 83.5% of a square
          case) so the square artwork fits without being cropped. */}
      <div className="absolute bottom-[8.25%] left-[12%] right-[4.5%] top-[8.25%] overflow-hidden rounded-[1px] bg-line/40 shadow-[0_1px_2px_rgba(19,19,22,0.3),0_6px_16px_-4px_rgba(19,19,22,0.35)]">
        {image}
      </div>

      {/* Hinged spine on the left */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[12%] border-r border-black/15"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.85) 0%, rgba(222,226,230,0.7) 45%, rgba(150,155,162,0.35) 100%)",
        }}
      />
      {/* Hinge teeth */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[3%] top-[7%] h-[13%] w-[6%] rounded-[1px] bg-black/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[7%] left-[3%] h-[13%] w-[6%] rounded-[1px] bg-black/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]"
      />
      {/* Vertical highlight along the spine fold */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-[2%] left-[11%] w-px bg-white/70"
      />

      {/* Glass thickness: bright top/left edges, darker bottom/right edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[3px]"
        style={{
          boxShadow:
            "inset 0 1.5px 0 rgba(255,255,255,0.9), inset 1.5px 0 0 rgba(255,255,255,0.6), inset 0 -1.5px 0 rgba(19,19,22,0.18), inset -1.5px 0 0 rgba(19,19,22,0.12)",
        }}
      />

      {/* Diagonal sheen across the whole case */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0.05) 55%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.28) 92%)",
        }}
      />
    </div>
  );
}
