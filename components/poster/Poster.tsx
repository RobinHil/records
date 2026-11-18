"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  EyeOff,
  Printer,
  Replace,
  Shapes,
  Shuffle,
} from "lucide-react";
import CoverPicker from "@/components/poster/CoverPicker";
import {
  averageColor,
  compareColors,
  dominantColor,
  familyOf,
  FAMILIES,
  type CoverColor,
  type Family,
} from "@/components/poster/color";
import { Choice, Group, Label, Slider } from "@/components/poster/controls";
import { exportDpi, renderPoster } from "@/components/poster/export";
import { computeLayout, PAPERS } from "@/components/poster/layout";
import {
  getDefaultSettings,
  getSettings,
  subscribeSettings,
  updateSettings,
  type Background,
  type Order,
  type PosterSettings,
} from "@/components/poster/settings";
import { useCollection } from "@/lib/use-collection";
import type { RecordDTO } from "@/lib/types";

/*
 * L'affiche de la collection : les pochettes en mosaique, rangees par couleur
 * dominante, a imprimer.
 *
 * Les pochettes sont celles que la synchronisation a deja rapatriees de
 * Discogs dans public/covers : servies par le site lui-meme, elles se lisent
 * pixel par pixel dans un canvas. Celles qui pointeraient encore vers
 * Discogs ne le peuvent pas - Discogs n'envoie pas d'en-tete CORS - et sont
 * laissees de cote.
 *
 * Ce qui entre dans l'affiche se decide en trois temps : les familles de
 * couleurs retenues, les pochettes masquees, puis un eventuel tirage au sort
 * d'un nombre donne. Viennent ensuite l'ordre - les couleurs, melangees ou
 * non, ou le hasard - et enfin les retouches a la main, choix d'une pochette
 * pour un emplacement ou echange par glisser-deposer.
 *
 * Deux sorties : l'impression du navigateur, ou l'affiche est une page au
 * format choisi (et donc un PDF via "Enregistrer en PDF"), et un JPEG a la
 * resolution d'impression, pour les tireurs qui ne prennent que des images.
 */

interface Cover {
  record: RecordDTO;
  img: HTMLImageElement;
  color: CoverColor;
  family: Family;
}

interface Drag {
  /** Emplacement de depart. */
  index: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Prise de la pochette, par rapport a son coin superieur gauche. */
  offsetX: number;
  offsetY: number;
  width: number;
  /** Faux tant que le pointeur n'a pas assez bouge pour un glisser. */
  active: boolean;
  target: number | null;
}

const BACKGROUNDS: Record<Background, { paper: string; ink: string }> = {
  white: { paper: "#ffffff", ink: "#131316" },
  black: { paper: "#131316", ink: "#fafaf8" },
};

const CONCURRENCY = 6;
// En dessous, une pochette imprimee commence a paraitre floue.
const SOFT_DPI = 150;
// Espacement des lettres de la legende, en em : le meme partout.
const TRACKING = 0.35;
// Deplacement, en pixels, a partir duquel un appui devient un glisser.
const DRAG_THRESHOLD = 5;
// Distingue le melange des places de celui du tirage, faits avec la meme graine.
const ORDER_SALT = 0x5bd1e995;

function isLocal(src: string | null): src is string {
  return !!src && !/^https?:/.test(src);
}

function randomSeed(): number {
  return 1 + Math.floor(Math.random() * (2 ** 31 - 1));
}

/**
 * Rang d'une pochette dans un tirage : un melange de son identifiant et de
 * la graine. Il ne depend pas des autres pochettes, si bien que masquer une
 * pochette ou changer de famille ne rebat pas tout le tirage.
 */
function draw(id: number, seed: number): number {
  let h = (id ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * L'ordre des pochettes sur l'affiche. Par couleur, une graine non nulle
 * decale chaque pochette d'un petit nombre de rangs au hasard : des teintes
 * voisines echangent leur place, et le degrade survit au melange.
 */
function arrange(chosen: Cover[], order: Order, seed: number): Cover[] {
  const salt = (seed ^ ORDER_SALT) >>> 0;
  if (order === "random") {
    return [...chosen].sort(
      (a, b) => draw(a.record.instanceId, salt) - draw(b.record.instanceId, salt)
    );
  }
  const sorted = [...chosen].sort((a, b) => compareColors(a.color, b.color));
  if (seed === 0) return sorted;
  const spread = Math.max(1.5, sorted.length * 0.06);
  const key = new Map(
    sorted.map((c, i) => [
      c.record.instanceId,
      i + ((draw(c.record.instanceId, salt) / 2 ** 32) * 2 - 1) * spread,
    ])
  );
  return sorted.sort(
    (a, b) => (key.get(a.record.instanceId) ?? 0) - (key.get(b.record.instanceId) ?? 0)
  );
}

/**
 * Rejoue les retouches a la main sur l'ordre calcule. Elles designent des
 * pochettes, pas des cases : elles survivent a un changement de format ou de
 * marge, qui renumerote les cases.
 */
function applyEdits(
  sequence: Cover[],
  edits: [number, number][],
  byId: Map<number, Cover>,
  hidden: Set<number>
): Cover[] {
  const out = [...sequence];
  const position = new Map(out.map((c, i) => [c.record.instanceId, i]));
  for (const [a, b] of edits) {
    const ia = position.get(a);
    const incoming = byId.get(b);
    if (ia === undefined || !incoming || hidden.has(b) || a === b) continue;
    const ib = position.get(b);
    if (ib !== undefined) {
      [out[ia], out[ib]] = [out[ib], out[ia]];
      position.set(a, ib);
      position.set(b, ia);
    } else {
      out[ia] = incoming;
      position.delete(a);
      position.set(b, ia);
    }
  }
  return out;
}

/** Largeur d'un texte en capitales, en em, dans la police de la page. */
function captionMeasure(): (text: string) => number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return (text) => text.length;
  ctx.font = `600 100px ${getComputedStyle(document.body).fontFamily}`;
  const spacing = "letterSpacing" in ctx;
  if (spacing) ctx.letterSpacing = `${TRACKING * 100}px`;
  return (text) =>
    ctx.measureText(text.toUpperCase()).width / 100 + (spacing ? 0 : TRACKING * text.length);
}

function cm(mm: number): string {
  return `${(mm / 10).toFixed(1)} cm`;
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
          const color = dominantColor(img);
          done.push({ record, img, color, family: familyOf(color) });
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

function usePosterSettings() {
  const settings = useSyncExternalStore(subscribeSettings, getSettings, getDefaultSettings);
  const update = useCallback(
    <K extends keyof PosterSettings>(key: K, value: PosterSettings[K]) =>
      updateSettings({ [key]: value }),
    []
  );
  return { settings, update };
}

function TileAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-tile-action
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex aspect-square w-[min(26px,36cqw)] items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_2px_8px_rgba(19,19,22,0.3)] backdrop-blur transition-colors hover:bg-white"
    >
      {children}
    </button>
  );
}

export default function Poster() {
  const { collection, failed } = useCollection();
  const { covers, read } = useCovers(collection?.records ?? null);
  const { settings, update } = usePosterSettings();
  const [measure, setMeasure] = useState<((text: string) => number) | undefined>();
  const [exporting, setExporting] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // La legende se mesure dans la vraie police, une fois celle-ci chargee.
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setMeasure(() => captionMeasure());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const paper = PAPERS.find((p) => p.id === settings.paperId) ?? PAPERS[0];
  const colors = BACKGROUNDS[settings.background];
  const toRead = collection?.records.filter((r) => isLocal(r.coverSrc)).length ?? 0;
  const hiddenIds = useMemo(() => new Set(settings.hidden), [settings.hidden]);
  const byId = useMemo(
    () => new Map((covers ?? []).map((c) => [c.record.instanceId, c])),
    [covers]
  );

  // Le format, puis le masquage : ce qui reste est ce que les familles
  // comptent et se partagent.
  const pool = useMemo(
    () =>
      (covers ?? []).filter(
        (c) =>
          !hiddenIds.has(c.record.instanceId) &&
          (settings.format === "both" ||
            (settings.format === "vinyl"
              ? c.record.format === "VINYL"
              : c.record.format === "CD"))
      ),
    [covers, hiddenIds, settings.format]
  );

  const families = useMemo(
    () =>
      FAMILIES.map((f) => {
        const members = pool.filter((c) => c.family === f.id);
        return {
          ...f,
          count: members.length,
          swatch: averageColor(members.map((m) => m.color)) ?? f.fallback,
        };
      }),
    [pool]
  );

  const candidates = useMemo(() => {
    if (settings.families.length === 0) return pool;
    const wanted = new Set(settings.families);
    return pool.filter((c) => wanted.has(c.family));
  }, [pool, settings.families]);

  const limit =
    settings.limit !== null && settings.limit < candidates.length ? settings.limit : null;

  const items = useMemo(() => {
    let chosen = candidates;
    if (limit !== null) {
      chosen = [...candidates]
        .sort(
          (a, b) =>
            draw(a.record.instanceId, settings.seed) - draw(b.record.instanceId, settings.seed)
        )
        .slice(0, limit);
    }
    return applyEdits(
      arrange(chosen, settings.order, settings.seed),
      settings.edits,
      byId,
      hiddenIds
    );
  }, [candidates, limit, settings.order, settings.seed, settings.edits, byId, hiddenIds]);

  const hiddenCovers = useMemo(
    () => (covers ?? []).filter((c) => hiddenIds.has(c.record.instanceId)),
    [covers, hiddenIds]
  );

  const pickerCovers = useMemo(() => {
    const onPoster = new Set(items.map((c) => c.record.instanceId));
    return [...(covers ?? [])]
      .sort((a, b) => compareColors(a.color, b.color))
      .map((c) => ({
        record: c.record,
        onPoster: onPoster.has(c.record.instanceId),
        hidden: hiddenIds.has(c.record.instanceId),
      }));
  }, [covers, items, hiddenIds]);

  const layout = useMemo(
    () =>
      computeLayout(items.length, {
        paper,
        orientation: settings.orientation,
        margin: settings.margin,
        gap: settings.gap,
        flow: settings.flow,
        sizing: settings.sizing,
        shapeSeed: settings.shapeSeed,
        caption: settings.caption,
        captionPosition: settings.captionPosition,
        measure,
      }),
    [
      items.length,
      paper,
      settings.orientation,
      settings.margin,
      settings.gap,
      settings.flow,
      settings.sizing,
      settings.shapeSeed,
      settings.caption,
      settings.captionPosition,
      measure,
    ]
  );

  // Nettete reelle a l'impression : la pire des pochettes, chacune etiree
  // sur le cote de sa case.
  const coverDpi = useMemo(() => {
    if (items.length === 0 || layout.tile <= 0) return null;
    return Math.round(
      Math.min(
        ...layout.cells.map((cell, i) => {
          const img = items[i].img;
          return Math.min(img.naturalWidth, img.naturalHeight) / (cell.size / 25.4);
        })
      )
    );
  }, [items, layout]);

  const unreadable = covers ? (collection?.records.length ?? 0) - covers.length : 0;
  const ready = covers !== null && items.length > 0;
  const caption = settings.caption.trim();
  const pickerRecord = pickerSlot !== null ? (items[pickerSlot]?.record ?? null) : null;

  function toggleFamily(id: Family) {
    update(
      "families",
      settings.families.includes(id)
        ? settings.families.filter((f) => f !== id)
        : [...settings.families, id]
    );
  }

  function pick(record: RecordDTO) {
    const occupant = pickerRecord;
    setPickerSlot(null);
    if (!occupant || occupant.instanceId === record.instanceId) return;
    updateSettings({
      edits: [...settings.edits, [occupant.instanceId, record.instanceId]],
      hidden: settings.hidden.filter((id) => id !== record.instanceId),
    });
  }

  // L'emplacement sous le pointeur, retrouve dans la mise en page en
  // millimetres plutot que dans le DOM, que la vignette deplacee recouvre.
  function slotAt(clientX: number, clientY: number): number | null {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((clientX - rect.left) / rect.width) * layout.width;
    const y = ((clientY - rect.top) / rect.height) * layout.height;
    const hit = layout.cells.findIndex(
      (c) => x >= c.x && x <= c.x + c.size && y >= c.y && y <= c.y + c.size
    );
    return hit === -1 ? null : hit;
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>, index: number) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-tile-action]")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({
      index,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      active: false,
      target: null,
    });
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const active =
      drag.active ||
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    if (!active) return;
    setDrag({
      ...drag,
      x: e.clientX,
      y: e.clientY,
      active,
      target: slotAt(e.clientX, e.clientY),
    });
  }

  function endDrag() {
    if (drag?.active && drag.target !== null && drag.target !== drag.index) {
      update("edits", [
        ...settings.edits,
        [items[drag.index].record.instanceId, items[drag.target].record.instanceId],
      ]);
    }
    setDrag(null);
  }

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
          caption,
          fontFamily: getComputedStyle(document.body).fontFamily,
        }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `records-poster-${paper.id}-${settings.orientation}.jpg`;
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

  let emptyMessage: string | null = null;
  if (failed) emptyMessage = "The collection could not be loaded. Try reloading the page.";
  else if (covers !== null && covers.length === 0)
    emptyMessage =
      "No cover to lay out. Covers are read from the copies the sync stores with the site.";
  else if (covers !== null) emptyMessage = "No cover matches this selection.";

  const largeSize = layout.cells.find((c) => c.size > layout.tile)?.size;
  const dragged = drag?.active ? items[drag.index] : null;

  return (
    // Sur grand ecran, la page epouse la fenetre : seul le panneau de
    // reglages defile.
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden print:block print:h-auto print:overflow-visible">
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

      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 px-4 pb-16 pt-24 sm:px-6 lg:min-h-0 lg:flex-1 lg:flex-row lg:pb-6 print:block print:p-0">
        <div className="flex min-w-0 flex-1 items-start justify-center">
          <div
            ref={sheetRef}
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
                const isSource = drag?.active && drag.index === i;
                const isTarget = drag?.active && drag.target === i && drag.index !== i;
                return (
                  <div
                    key={record.instanceId}
                    onPointerDown={(e) => startDrag(e, i)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={() => setDrag(null)}
                    title={`${record.title} - ${record.artist}`}
                    className={`group absolute animate-[poster-in_300ms_ease-out] select-none transition-[left,top,width,height,opacity] duration-300 ease-out lg:touch-none ${
                      drag?.active ? "cursor-grabbing" : "cursor-grab"
                    } ${isSource ? "opacity-25" : ""}`}
                    style={{
                      left: `${(cell.x / W) * 100}%`,
                      top: `${(cell.y / H) * 100}%`,
                      width: `${(cell.size / W) * 100}%`,
                      height: `${(cell.size / H) * 100}%`,
                      containerType: "inline-size",
                    }}
                  >
                    {/* Deja chargee et analysee : l'<img> la reprend du cache. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={record.coverSrc as string}
                      alt={`${record.title} - ${record.artist}`}
                      draggable={false}
                      className="pointer-events-none h-full w-full object-cover"
                    />
                    {isTarget && (
                      <span className="pointer-events-none absolute inset-0 bg-white/25 shadow-[inset_0_0_0_3px_white,inset_0_0_0_4px_rgba(19,19,22,0.35)]" />
                    )}
                    {!drag?.active && (
                      // Sans survol possible (ecran tactile), les boutons
                      // restent affiches : ils seraient sinon inaccessibles.
                      <span className="absolute right-0 top-0 flex gap-[6cqw] p-[6cqw] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 print:hidden">
                        <TileAction label="Replace this cover" onClick={() => setPickerSlot(i)}>
                          <Replace className="h-[55%] w-[55%]" strokeWidth={1.75} aria-hidden />
                        </TileAction>
                        <TileAction
                          label="Hide this cover"
                          onClick={() => update("hidden", [...settings.hidden, record.instanceId])}
                        >
                          <EyeOff className="h-[55%] w-[55%]" strokeWidth={1.75} aria-hidden />
                        </TileAction>
                      </span>
                    )}
                  </div>
                );
              })}

            {ready && layout.caption && (
              <p
                className="pointer-events-none absolute whitespace-nowrap font-semibold uppercase leading-none transition-[left,top,font-size] duration-300 ease-out"
                style={{
                  left: `${(layout.caption.x / W) * 100}%`,
                  top: `${(layout.caption.y / H) * 100}%`,
                  fontSize: `${(layout.caption.size / W) * 100}cqw`,
                  letterSpacing: `${TRACKING}em`,
                  // L'espacement s'ajoute aussi apres la derniere lettre : le
                  // texte est decale d'autant pour rester centre.
                  transform: `translate(calc(-50% + ${TRACKING / 2}em), -50%)`,
                  color: colors.ink,
                }}
              >
                {caption}
              </p>
            )}

            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center print:hidden">
                {emptyMessage ? (
                  <p className="text-sm text-ink-muted">{emptyMessage}</p>
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

        <aside className="w-full lg:flex lg:h-full lg:w-80 lg:shrink-0 lg:flex-col print:hidden">
          <div className="space-y-10 pb-8 lg:-mr-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-3">
            <Group title="Selection">
              <Choice
                label="Records"
                value={settings.format}
                options={[
                  { value: "vinyl", label: "Vinyl" },
                  { value: "cd", label: "CD" },
                  { value: "both", label: "Both" },
                ]}
                onChange={(v) => update("format", v)}
              />

              <div>
                <Label
                  aside={
                    settings.families.length > 0 && (
                      <button
                        type="button"
                        onClick={() => update("families", [])}
                        className="underline decoration-line-strong underline-offset-4 hover:text-ink"
                      >
                        All colors
                      </button>
                    )
                  }
                >
                  Colors
                </Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {families.map((f) => {
                    const active = settings.families.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={active}
                        disabled={f.count === 0 && !active}
                        onClick={() => toggleFamily(f.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition-colors disabled:opacity-35 ${
                          active
                            ? "border-ink bg-surface"
                            : "border-line hover:border-line-strong"
                        }`}
                      >
                        <span
                          className="h-5 w-5 rounded-full ring-1 ring-black/10"
                          style={{ background: f.swatch }}
                          aria-hidden
                        />
                        <span className="text-[11px] leading-none text-ink-soft">{f.label}</span>
                        <span className="text-[10px] leading-none tabular-nums text-ink-muted">
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Slider
                label="Covers"
                display={
                  limit === null ? `All ${candidates.length}` : `${limit} of ${candidates.length}`
                }
                value={limit ?? candidates.length}
                min={1}
                max={Math.max(candidates.length, 1)}
                step={1}
                disabled={candidates.length < 2}
                onChange={(v) => update("limit", v >= candidates.length ? null : v)}
              />

              <div>
                <Label
                  aside={
                    hiddenCovers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => update("hidden", [])}
                        className="underline decoration-line-strong underline-offset-4 hover:text-ink"
                      >
                        Show all
                      </button>
                    )
                  }
                >
                  Hidden{hiddenCovers.length > 0 ? ` (${hiddenCovers.length})` : ""}
                </Label>
                {hiddenCovers.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    Hover a cover on the poster and use its hide button to leave it out.
                  </p>
                ) : (
                  <div className="grid grid-cols-6 gap-1.5">
                    {hiddenCovers.map(({ record }) => (
                      <button
                        key={record.instanceId}
                        type="button"
                        onClick={() =>
                          update(
                            "hidden",
                            settings.hidden.filter((h) => h !== record.instanceId)
                          )
                        }
                        title={`${record.title} - ${record.artist}\nClick to put it back`}
                        className="aspect-square overflow-hidden rounded-[2px] opacity-60 ring-1 ring-black/10 transition-opacity hover:opacity-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={record.coverSrc as string}
                          alt={`${record.title} - ${record.artist}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Group>

            <Group title="Arrangement">
              <Choice
                label="Order"
                value={settings.order}
                options={[
                  { value: "color", label: "By color" },
                  { value: "random", label: "Random" },
                ]}
                onChange={(v) => update("order", v)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => update("seed", randomSeed())}
                  title={
                    settings.order === "color"
                      ? "Move covers around while keeping the color gradient"
                      : "Move covers around at random"
                  }
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                >
                  <Shuffle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Shuffle covers
                </button>
                {settings.sizing === "mixed" && layout.large > 0 && (
                  <button
                    type="button"
                    onClick={() => update("shapeSeed", randomSeed())}
                    title="Move the large covers to other spots"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <Shapes className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    Shuffle shapes
                  </button>
                )}
              </div>
              <div>
                <Label
                  aside={
                    settings.edits.length > 0 && (
                      <button
                        type="button"
                        onClick={() => update("edits", [])}
                        className="underline decoration-line-strong underline-offset-4 hover:text-ink"
                      >
                        Reset
                      </button>
                    )
                  }
                >
                  Manual changes
                  {settings.edits.length > 0 ? ` (${settings.edits.length})` : ""}
                </Label>
                <p className="text-xs text-ink-muted">
                  Drag a cover onto another to swap them, or use its replace button to
                  pick the cover for that spot.
                </p>
              </div>
            </Group>

            <Group title="Layout">
              <Choice
                label="Paper"
                value={settings.paperId}
                options={PAPERS.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(v) => update("paperId", v)}
                columns={3}
              />
              <Choice
                label="Orientation"
                value={settings.orientation}
                options={[
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
                onChange={(v) => update("orientation", v)}
              />
              <Choice
                label="Cover sizes"
                value={settings.sizing}
                options={[
                  { value: "mixed", label: "Fill the page" },
                  { value: "uniform", label: "All the same" },
                ]}
                onChange={(v) => update("sizing", v)}
              />
              <Choice
                label="Color flow"
                value={settings.flow}
                options={[
                  { value: "rows", label: "Rows" },
                  { value: "columns", label: "Columns" },
                  { value: "diagonal", label: "Diagonal" },
                ]}
                onChange={(v) => update("flow", v)}
              />
              <Choice
                label="Background"
                value={settings.background}
                options={[
                  { value: "white", label: "White" },
                  { value: "black", label: "Black" },
                ]}
                onChange={(v) => update("background", v)}
              />
              <Slider
                label="Margin"
                display={`${settings.margin} mm`}
                value={settings.margin}
                min={0}
                max={40}
                step={1}
                onChange={(v) => update("margin", v)}
              />
              <Slider
                label="Gap"
                display={`${settings.gap} mm`}
                value={settings.gap}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) => update("gap", v)}
              />
              <label className="block">
                <Label>Caption</Label>
                <input
                  type="text"
                  value={settings.caption}
                  maxLength={60}
                  onChange={(e) => update("caption", e.target.value)}
                  placeholder="Optional text on the poster"
                  className="h-10 w-full rounded-full border border-line bg-surface/70 px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-surface"
                />
              </label>
              {caption && (
                <Choice
                  label="Caption position"
                  value={settings.captionPosition}
                  options={[
                    { value: "top", label: "Top" },
                    { value: "bottom", label: "Bottom" },
                    { value: "band", label: "Middle band" },
                    { value: "framed", label: "Framed" },
                  ]}
                  onChange={(v) => update("captionPosition", v)}
                  columns={2}
                />
              )}
            </Group>
          </div>

          <div className="space-y-3 border-t border-line bg-canvas pt-4">
            {ready && (
              <div className="space-y-1 text-xs text-ink-muted">
                <p className="tabular-nums">
                  {items.length} {items.length === 1 ? "cover" : "covers"} of{" "}
                  {cm(layout.tile)}
                  {layout.large > 0 &&
                    largeSize &&
                    `, ${layout.large} of them at ${cm(largeSize)}`}
                </p>
                {coverDpi !== null && (
                  <p className={coverDpi < SOFT_DPI ? "text-ink" : undefined}>
                    Covers print at about {coverDpi} dpi
                    {coverDpi < SOFT_DPI && ": they will look soft, try a smaller paper."}
                  </p>
                )}
                {unreadable > 0 && (
                  <p>
                    {unreadable} {unreadable === 1 ? "record has" : "records have"} no
                    readable cover.
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
            </div>
            <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
              To print, pick the {paper.label} paper size in the print dialog and turn
              off headers and footers.
            </p>
          </div>
        </aside>
      </main>

      {dragged && drag && (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden shadow-[0_24px_60px_-12px_rgba(19,19,22,0.55)] ring-1 ring-black/10 print:hidden"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
            height: drag.width,
            transform: "scale(1.06) rotate(-2deg)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dragged.record.coverSrc as string}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <CoverPicker
        slot={pickerRecord}
        covers={pickerCovers}
        onPick={pick}
        onClose={() => setPickerSlot(null)}
      />
    </div>
  );
}
