"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { compareColors, dominantColor, type CoverColor } from "@/components/poster/color";
import { exportDpi, renderPoster } from "@/components/poster/export";
import {
  computeLayout,
  PAPERS,
  type Flow,
  type Orientation,
} from "@/components/poster/layout";
import { useCollection } from "@/lib/use-collection";
import type { FormatFilter, RecordDTO } from "@/lib/types";

/*
 * L'affiche de la collection : toutes les pochettes en mosaique, rangees par
 * couleur dominante, a imprimer.
 *
 * Les pochettes sont celles que la synchronisation a deja rapatriees de
 * Discogs dans public/covers : servies par le site lui-meme, elles se lisent
 * pixel par pixel dans un canvas. Celles qui pointeraient encore vers
 * Discogs ne le peuvent pas - Discogs n'envoie pas d'en-tete CORS - et sont
 * laissees de cote.
 *
 * Deux sorties : l'impression du navigateur, ou l'affiche est une page au
 * format choisi (et donc un PDF via "Enregistrer en PDF"), et un JPEG a la
 * resolution d'impression, pour les tireurs qui ne prennent que des images.
 */

interface Cover {
  record: RecordDTO;
  img: HTMLImageElement;
  color: CoverColor;
}

type Background = "white" | "black";

const BACKGROUNDS: Record<Background, { paper: string; ink: string }> = {
  white: { paper: "#ffffff", ink: "#131316" },
  black: { paper: "#131316", ink: "#fafaf8" },
};

const CONCURRENCY = 6;
// En dessous, une pochette imprimee commence a paraitre floue.
const SOFT_DPI = 150;

function isLocal(src: string | null): src is string {
  return !!src && !/^https?:/.test(src);
}

function useCovers(records: RecordDTO[] | null) {
  const [covers, setCovers] = useState<Cover[] | null>(null);
  const [read, setRead] = useState(0);

  useEffect(() => {
    if (!records) return;
    let cancelled = false;
    const queue = records.filter((r) => isLocal(r.coverSrc));
    const done: Cover[] = [];
    let next = 0;
    let settled = 0;

    async function worker() {
      while (next < queue.length && !cancelled) {
        const record = queue[next++];
        try {
          const img = new Image();
          img.src = record.coverSrc as string;
          await img.decode();
          done.push({ record, img, color: dominantColor(img) });
        } catch {
          // Introuvable ou illisible : la pochette est laissee hors de l'affiche.
        }
        settled += 1;
        if (!cancelled) setRead(settled);
      }
    }

    Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
      if (!cancelled) setCovers(done);
    });
    return () => {
      cancelled = true;
    };
  }, [records]);

  return { covers, read };
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = options.length,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </h3>
      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-1 border border-line bg-surface/70 p-1 ${
          options.length > columns ? "rounded-2xl" : "rounded-full"
        }`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        {label}
        <span className="font-normal normal-case tracking-normal tabular-nums text-ink-soft">
          {value} mm
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-ink"
      />
    </label>
  );
}

export default function Poster() {
  const { collection, failed } = useCollection();
  const { covers, read } = useCovers(collection?.records ?? null);

  const [paperId, setPaperId] = useState("a2");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [flow, setFlow] = useState<Flow>("rows");
  const [format, setFormat] = useState<FormatFilter>("both");
  const [background, setBackground] = useState<Background>("white");
  const [margin, setMargin] = useState(20);
  const [gap, setGap] = useState(2);
  const [caption, setCaption] = useState("");
  const [exporting, setExporting] = useState(false);

  const paper = PAPERS.find((p) => p.id === paperId) ?? PAPERS[0];
  const colors = BACKGROUNDS[background];
  const toRead = collection?.records.filter((r) => isLocal(r.coverSrc)).length ?? 0;

  const items = useMemo(
    () =>
      (covers ?? [])
        .filter(
          (c) =>
            format === "both" ||
            (format === "vinyl" ? c.record.format === "VINYL" : c.record.format === "CD")
        )
        .sort((a, b) => compareColors(a.color, b.color)),
    [covers, format]
  );

  const layout = useMemo(
    () =>
      computeLayout(items.length, {
        paper,
        orientation,
        margin,
        gap,
        flow,
        caption: caption.trim() !== "",
      }),
    [items.length, paper, orientation, margin, gap, flow, caption]
  );

  // Nettete reelle a l'impression : celle de la plus petite pochette, etiree
  // sur le cote d'une case.
  const coverDpi = useMemo(() => {
    if (items.length === 0 || layout.tile <= 0) return null;
    const smallest = Math.min(
      ...items.map((c) => Math.min(c.img.naturalWidth, c.img.naturalHeight))
    );
    return Math.round(smallest / (layout.tile / 25.4));
  }, [items, layout.tile]);

  const missing = covers ? (collection?.records.length ?? 0) - covers.length : 0;
  const ready = covers !== null && items.length > 0;

  async function downloadJpeg() {
    setExporting(true);
    try {
      await document.fonts.ready;
      const { blob } = await renderPoster(
        layout,
        items.map((c) => c.img),
        {
          background: colors.paper,
          ink: colors.ink,
          caption: caption.trim(),
          fontFamily: getComputedStyle(document.body).fontFamily,
        }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `records-poster-${paper.id}-${orientation}.jpg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setExporting(false);
    }
  }

  const W = layout.width;
  const H = layout.height;

  // A l'impression, la page prend le format de l'affiche et l'affiche toute
  // la page : le reste de l'interface est masque par les classes print:hidden.
  const printCss = `
    @media print {
      @page { size: ${W}mm ${H}mm; margin: 0; }
      html, body { background: ${colors.paper} !important; }
      .poster-sheet {
        position: fixed !important;
        top: 0;
        left: 0;
        width: ${W}mm !important;
        height: ${H}mm !important;
        box-shadow: none !important;
      }
    }
  `;

  return (
    <div className="min-h-screen">
      <style>{printCss}</style>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/80 bg-[var(--glass)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_32px_-20px_rgba(19,19,22,0.25)] backdrop-blur-xl backdrop-saturate-150 print:hidden">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex h-10 items-center gap-2 rounded-full pr-2 text-sm font-semibold uppercase tracking-[0.35em] text-ink transition-colors hover:text-ink-soft"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Records
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">Poster</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1800px] flex-col gap-8 px-4 pb-16 pt-24 sm:px-6 lg:flex-row lg:items-start print:block print:p-0">
        <div className="flex min-w-0 flex-1 justify-center">
          <div
            className="poster-sheet relative overflow-hidden shadow-[0_2px_6px_rgba(19,19,22,0.08),0_30px_70px_-30px_rgba(19,19,22,0.45)] ring-1 ring-black/5"
            style={{
              aspectRatio: `${W} / ${H}`,
              width: `min(100%, calc((100dvh - 8rem) * ${W / H}))`,
              background: colors.paper,
              containerType: "inline-size",
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          >
            {ready &&
              layout.cells.map((cell, i) => {
                const { record } = items[i];
                return (
                  // Les pochettes sont deja chargees et analysees : l'<img>
                  // les reprend du cache, sans chargement differe.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={record.instanceId}
                    src={record.coverSrc as string}
                    alt={`${record.title} - ${record.artist}`}
                    title={`${record.title} - ${record.artist}`}
                    draggable={false}
                    className="absolute object-cover"
                    style={{
                      left: `${(cell.x / W) * 100}%`,
                      top: `${(cell.y / H) * 100}%`,
                      width: `${(layout.tile / W) * 100}%`,
                      height: `${(layout.tile / H) * 100}%`,
                    }}
                  />
                );
              })}

            {ready && layout.caption && (
              <p
                className="absolute inset-x-0 -translate-y-1/2 text-center font-semibold uppercase leading-none tracking-[0.35em]"
                style={{
                  top: `${(layout.caption.y / H) * 100}%`,
                  fontSize: `${(layout.caption.size / W) * 100}cqw`,
                  // L'espacement s'ajoute aussi apres la derniere lettre.
                  paddingLeft: "0.35em",
                  color: colors.ink,
                }}
              >
                {caption.trim()}
              </p>
            )}

            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center print:hidden">
                {failed ? (
                  <p className="text-sm text-ink-muted">
                    The collection could not be loaded. Try reloading the page.
                  </p>
                ) : covers !== null ? (
                  <p className="text-sm text-ink-muted">
                    No cover to lay out. Covers are read from the copies the sync
                    stores with the site.
                  </p>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                      Reading covers
                    </p>
                    <p className="text-sm tabular-nums text-ink-soft">
                      {read} / {toRead || "..."}
                    </p>
                    <div className="h-px w-40 overflow-hidden bg-line">
                      <div
                        className="h-full bg-ink transition-[width]"
                        style={{ width: `${toRead ? (read / toRead) * 100 : 0}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="w-full space-y-6 lg:sticky lg:top-24 lg:w-80 lg:shrink-0 print:hidden">
          <Choice
            label="Paper"
            value={paperId}
            options={PAPERS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={setPaperId}
            columns={3}
          />
          <Choice
            label="Orientation"
            value={orientation}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
            onChange={setOrientation}
          />
          <Choice
            label="Color flow"
            value={flow}
            options={[
              { value: "rows", label: "Rows" },
              { value: "columns", label: "Columns" },
              { value: "diagonal", label: "Diagonal" },
            ]}
            onChange={setFlow}
          />
          <Choice
            label="Records"
            value={format}
            options={[
              { value: "vinyl", label: "Vinyl" },
              { value: "cd", label: "CD" },
              { value: "both", label: "Both" },
            ]}
            onChange={setFormat}
          />
          <Choice
            label="Background"
            value={background}
            options={[
              { value: "white", label: "White" },
              { value: "black", label: "Black" },
            ]}
            onChange={setBackground}
          />
          <Slider label="Margin" value={margin} min={0} max={40} step={1} onChange={setMargin} />
          <Slider label="Gap" value={gap} min={0} max={10} step={0.5} onChange={setGap} />
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
              Caption
            </span>
            <input
              type="text"
              value={caption}
              maxLength={60}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Optional, printed under the covers"
              className="h-10 w-full rounded-full border border-line bg-surface/70 px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-surface"
            />
          </label>

          {ready && (
            <div className="space-y-1 border-t border-line pt-5 text-xs text-ink-muted">
              <p className="tabular-nums">
                {items.length} {items.length === 1 ? "cover" : "covers"}, {layout.cols} x{" "}
                {layout.rows}, {(layout.tile / 10).toFixed(1)} cm each
              </p>
              {coverDpi !== null && (
                <p className={coverDpi < SOFT_DPI ? "text-ink" : undefined}>
                  Covers print at about {coverDpi} dpi
                  {coverDpi < SOFT_DPI && ": they will look soft, try a smaller paper."}
                </p>
              )}
              {missing > 0 && (
                <p>
                  {missing} {missing === 1 ? "record has" : "records have"} no readable
                  cover and {missing === 1 ? "is" : "are"} left out.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={() => window.print()}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Print or save as PDF
            </button>
            <button
              type="button"
              disabled={!ready || exporting}
              onClick={downloadJpeg}
              className="flex h-10 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-40"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {exporting ? "Rendering..." : `Download JPEG, ${exportDpi(layout)} dpi`}
            </button>
            <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
              To print, pick the {paper.label} paper size in the print dialog and
              turn off headers and footers.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
