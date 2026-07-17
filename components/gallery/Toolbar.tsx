"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  Search,
  Star,
  Tags,
  X,
} from "lucide-react";
import Popover from "@/components/gallery/Popover";
import type { FormatFilter, SortKey } from "@/lib/types";

export interface GalleryFilters {
  q: string;
  format: FormatFilter;
  sort: SortKey;
  genres: string[];
  favorites: boolean;
  recentEnabled: boolean;
  recentCount: number;
}

const SORT_LABELS: Record<SortKey, string> = {
  custom: "My order",
  album: "Album A-Z",
  artist: "Artist A-Z",
  year_asc: "Oldest first",
  year_desc: "Newest first",
  added: "Recently added",
};

const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
  { value: "vinyl", label: "Vinyl" },
  { value: "cd", label: "CD" },
  { value: "both", label: "Both" },
];

export default function Toolbar({
  filters,
  onChange,
  genres,
  total,
}: {
  filters: GalleryFilters;
  onChange: (patch: Partial<GalleryFilters>) => void;
  genres: string[];
  total: number;
}) {
  function toggleGenre(genre: string) {
    onChange({
      genres: filters.genres.includes(genre)
        ? filters.genres.filter((g) => g !== genre)
        : [...filters.genres, genre],
    });
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/80 bg-[var(--glass)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_32px_-20px_rgba(19,19,22,0.25)] backdrop-blur-xl backdrop-saturate-150">
      {/* Row 1: identity, search, format */}
      <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-6 pb-3 pt-4">
        <span className="hidden select-none text-sm font-semibold uppercase tracking-[0.35em] text-ink sm:block">
          Records
        </span>

        <div className="relative mx-auto w-full max-w-xl">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search albums or artists"
            className="h-10 w-full rounded-full border border-line bg-surface/70 pl-11 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-surface"
          />
        </div>

        <div
          role="radiogroup"
          aria-label="Format"
          className="flex shrink-0 rounded-full border border-line bg-surface/70 p-1"
        >
          {FORMAT_OPTIONS.map((opt) => {
            const active = filters.format === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ format: opt.value })}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-ink text-canvas"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: sort + filters, kept slim and quiet */}
      <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-6 pb-3 text-xs">
        <Popover
          trigger={(open) => (
            <button
              type="button"
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-medium transition-colors ${
                open
                  ? "border-line-strong bg-surface text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              {SORT_LABELS[filters.sort]}
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        >
          <ul className="py-1.5">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onChange({ sort: key })}
                  className="flex w-full items-center justify-between gap-6 px-4 py-2 text-left text-xs text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {SORT_LABELS[key]}
                  {filters.sort === key && (
                    <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2} aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Popover>

        <span className="h-4 w-px bg-line" aria-hidden />

        <button
          type="button"
          aria-pressed={filters.favorites}
          onClick={() => onChange({ favorites: !filters.favorites })}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${
            filters.favorites
              ? "border-line-strong bg-ink text-canvas"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <Star
            className="h-3.5 w-3.5"
            strokeWidth={1.75}
            fill={filters.favorites ? "currentColor" : "none"}
            aria-hidden
          />
          Favorites
        </button>

        <Popover
          trigger={(open) => (
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${
                open || filters.genres.length > 0
                  ? "border-line-strong bg-surface text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              <Tags className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Genres
              {filters.genres.length > 0 && (
                <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] leading-none text-canvas">
                  {filters.genres.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        >
          <div className="max-h-80 overflow-y-auto py-1.5">
            {genres.length === 0 && (
              <p className="px-4 py-2 text-xs text-ink-muted">
                No genres yet - run a sync first.
              </p>
            )}
            {genres.map((genre) => {
              const checked = filters.genres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className="flex w-full items-center justify-between gap-6 px-4 py-2 text-left text-xs text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {genre}
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      checked
                        ? "border-ink bg-ink text-canvas"
                        : "border-line-strong"
                    }`}
                    aria-hidden
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
          </div>
          {filters.genres.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ genres: [] })}
              className="flex w-full items-center gap-1.5 border-t border-line px-4 py-2 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              <X className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              Clear genres
            </button>
          )}
        </Popover>

        <Popover
          trigger={(open) => (
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${
                open || filters.recentEnabled
                  ? "border-line-strong bg-surface text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              {filters.recentEnabled
                ? `Last ${filters.recentCount} added`
                : "Latest"}
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        >
          <div className="space-y-3 p-4">
            <label className="flex items-center justify-between gap-6 text-xs text-ink-soft">
              Only show latest additions
              <button
                type="button"
                role="switch"
                aria-checked={filters.recentEnabled}
                onClick={() =>
                  onChange({ recentEnabled: !filters.recentEnabled })
                }
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  filters.recentEnabled ? "bg-ink" : "bg-line-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all ${
                    filters.recentEnabled ? "left-4.5" : "left-0.5"
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between gap-6 text-xs text-ink-soft">
              Number of records
              <input
                type="number"
                min={1}
                max={500}
                value={filters.recentCount}
                onChange={(e) =>
                  onChange({
                    recentCount: Math.max(
                      1,
                      Math.min(500, Number(e.target.value) || 20)
                    ),
                  })
                }
                className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-right text-xs tabular-nums text-ink outline-none focus:border-line-strong"
              />
            </label>
          </div>
        </Popover>

        <span className="ml-auto tabular-nums text-ink-muted">
          {total} {total === 1 ? "record" : "records"}
        </span>
      </div>
    </header>
  );
}
