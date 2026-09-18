"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { Disc3 } from "lucide-react";
import DetailModal from "@/components/gallery/DetailModal";
import InfoBanner from "@/components/gallery/InfoBanner";
import RecordTile from "@/components/gallery/RecordTile";
import Toolbar from "@/components/gallery/Toolbar";
import {
  applyFilters,
  DEFAULT_FILTERS,
  type GalleryFilters,
} from "@/components/gallery/filtering";
import { withBasePath } from "@/lib/base-path";
import type { Collection, RecordDTO } from "@/lib/types";

/*
 * La galerie chargeait la collection page par page depuis /api/records, une
 * requete par frappe. Le site est statique : elle charge maintenant un unique
 * fichier, produit au build, et filtre en memoire. Ce qui supprime la
 * pagination, l'anti-rebond de la recherche et la course entre requetes, et
 * rend le filtrage instantane - au prix d'un telechargement unique au premier
 * affichage.
 */
export default function Gallery() {
  const [filters, setFilters] = useState<GalleryFilters>(DEFAULT_FILTERS);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState<RecordDTO | null>(null);
  const [selected, setSelected] = useState<RecordDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(withBasePath("/collection.json"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Collection>;
      })
      .then((data) => {
        if (!cancelled) setCollection(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () => (collection ? applyFilters(collection.records, filters) : []),
    [collection, filters]
  );

  const patchFilters = useCallback((patch: Partial<GalleryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const loading = collection === null && !failed;

  return (
    <div className="min-h-screen">
      <Toolbar
        filters={filters}
        onChange={patchFilters}
        genres={collection?.genres ?? []}
        total={items.length}
      />

      <main className="mx-auto max-w-[1800px] pt-32 sm:pt-24 pb-32">
        {loading ? (
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
              {failed
                ? "The collection could not be loaded. Try reloading the page."
                : "No records match. Try clearing the search or filters."}
            </p>
          </div>
        ) : (
          <VirtuosoGrid
            useWindowScroll
            totalCount={items.length}
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
