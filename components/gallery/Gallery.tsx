"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { Disc3 } from "lucide-react";
import DetailModal from "@/components/gallery/DetailModal";
import InfoBanner from "@/components/gallery/InfoBanner";
import RecordTile from "@/components/gallery/RecordTile";
import Toolbar, { type GalleryFilters } from "@/components/gallery/Toolbar";
import type { RecordDTO, RecordsPage } from "@/lib/types";

const PER_PAGE = 120;

const DEFAULT_FILTERS: GalleryFilters = {
  q: "",
  format: "both",
  sort: "custom",
  genres: [],
  favorites: false,
  recentEnabled: false,
  recentCount: 20,
};

function buildQuery(filters: GalleryFilters, page: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("perPage", String(PER_PAGE));
  params.set("sort", filters.sort);
  params.set("format", filters.format);
  if (filters.q) params.set("q", filters.q);
  if (filters.favorites) params.set("favorites", "1");
  if (filters.genres.length > 0) params.set("genres", filters.genres.join("|"));
  if (filters.recentEnabled) params.set("recent", String(filters.recentCount));
  return params.toString();
}

export default function Gallery() {
  const [filters, setFilters] = useState<GalleryFilters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<RecordDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<string[]>([]);
  const [hovered, setHovered] = useState<RecordDTO | null>(null);
  const [selected, setSelected] = useState<RecordDTO | null>(null);

  const requestSeq = useRef(0);
  const pageRef = useRef(1);
  const loadingMore = useRef(false);

  useEffect(() => {
    fetch("/api/genres")
      .then((r) => r.json())
      .then((data) => setGenres(data.genres ?? []))
      .catch(() => {});
  }, []);

  // Reload from page 1 whenever filters change; search input is debounced.
  useEffect(() => {
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/records?${buildQuery(filters, 1)}`);
        const data = (await res.json()) as RecordsPage;
        if (seq !== requestSeq.current) return;
        pageRef.current = 1;
        setItems(data.items);
        setTotal(data.total);
      } catch {
        // keep previous items on transient failure
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (loadingMore.current) return;
    if (items.length >= total) return;
    loadingMore.current = true;
    const seq = requestSeq.current;
    try {
      const next = pageRef.current + 1;
      const res = await fetch(`/api/records?${buildQuery(filters, next)}`);
      const data = (await res.json()) as RecordsPage;
      if (seq !== requestSeq.current) return;
      pageRef.current = next;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch {
      // retried on next endReached
    } finally {
      loadingMore.current = false;
    }
  }, [filters, items.length, total]);

  const patchFilters = useCallback((patch: Partial<GalleryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <div className="min-h-screen">
      <Toolbar
        filters={filters}
        onChange={patchFilters}
        genres={genres}
        total={total}
      />

      <main className="mx-auto max-w-[1800px] pt-32 sm:pt-24 pb-32">
        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 gap-6 px-6 pb-24 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-[2px] bg-line/70"
                style={{ animationDelay: `${(i % 7) * 90}ms` }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-40 text-center">
            <Disc3 className="h-10 w-10 text-line-strong" strokeWidth={1} aria-hidden />
            <p className="text-sm text-ink-muted">
              No records match. Try clearing the search or filters.
            </p>
          </div>
        ) : (
          <VirtuosoGrid
            useWindowScroll
            totalCount={items.length}
            endReached={loadMore}
            overscan={600}
            listClassName="grid grid-cols-2 gap-6 px-6 pb-24 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
            itemContent={(index) => {
              const record = items[index];
              if (!record) return null;
              return (
                <RecordTile
                  record={record}
                  onHover={setHovered}
                  onSelect={setSelected}
                />
              );
            }}
          />
        )}
      </main>

      <InfoBanner record={selected ? null : hovered} />
      <DetailModal record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
