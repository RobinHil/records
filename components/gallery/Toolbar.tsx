"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Star,
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

  const activeFilterCount =
    (filters.format !== "both" ? 1 : 0) +
    filters.genres.length +
    (filters.recentEnabled ? 1 : 0);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/80 bg-[var(--glass)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_32px_-20px_rgba(19,19,22,0.25)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <span className="hidden select-none text-sm font-semibold uppercase tracking-[0.35em] text-ink sm:block">
          Records
        </span>

        <div className="relative min-w-40 flex-1 sm:max-w-md">
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

        <div className="flex flex-wrap items-center gap-2 text-xs">
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

          <Popover
            trigger={(open) => (
              <button
                type="button"
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-medium transition-colors ${
                  open || activeFilterCount > 0
                    ? "border-line-strong bg-surface text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] leading-none text-canvas">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              </button>
            )}
          >
            <div className="w-64">
              <section className="border-b border-line p-4">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                  Format
                </h3>
                <div
                  role="radiogroup"
                  aria-label="Format"
                  className="flex rounded-full border border-line bg-surface/70 p-1"
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
                        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
              </section>

              <section className="border-b border-line py-3">
                <h3 className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                  Genres
                </h3>
                <div className="max-h-56 overflow-y-auto">
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
              </section>

              <section className="space-y-3 p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                  Latest additions
                </h3>
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
              </section>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      format: "both",
                      genres: [],
                      recentEnabled: false,
                    })
                  }
                  className="flex w-full items-center gap-1.5 border-t border-line px-4 py-2 text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  <X className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                  Clear filters
                </button>
              )}
            </div>
          </Popover>

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
        </div>

        <span className="ml-auto hidden tabular-nums text-xs text-ink-muted md:block">
          {total} {total === 1 ? "record" : "records"}
        </span>
      </div>
    </header>
  );
}
