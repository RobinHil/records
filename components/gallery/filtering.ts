import type { FormatFilter, RecordDTO, SortKey } from "@/lib/types";

/*
 * Filtrage et tri de la collection, dans le navigateur.
 *
 * C'etait du SQL, dans lib/records.ts : une requete par frappe, paginee 120
 * par 120. Le site est statique, il n'y a plus de serveur pour repondre - la
 * collection entiere est chargee une fois et tout se fait ici, en memoire.
 *
 * Les regles sont reprises telles quelles de l'ancienne requete, y compris ses
 * details : `searchText` est deja en minuscules en base, la correspondance de
 * genre est exacte et porte sur les genres comme sur les styles, et `recent`
 * se calcule sur toute la collection avant les autres filtres.
 */

export interface GalleryFilters {
  q: string;
  format: FormatFilter;
  sort: SortKey;
  genres: string[];
  favorites: boolean;
  recentEnabled: boolean;
  recentCount: number;
}

export const DEFAULT_FILTERS: GalleryFilters = {
  q: "",
  format: "both",
  sort: "custom",
  genres: [],
  favorites: false,
  recentEnabled: false,
  recentCount: 20,
};

// Ordre des valeurs nulles : l'ancienne requete posait `nulls: "last"` sur
// `year` et `customOrder`. Un disque sans annee ou sans rang manuel passe donc
// apres les autres, dans les deux sens de tri.
function nullsLast(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
}

function compare(sort: SortKey): (a: RecordDTO, b: RecordDTO) => number {
  switch (sort) {
    case "album":
      return (a, b) =>
        a.title.localeCompare(b.title) || a.artistSort.localeCompare(b.artistSort);
    case "artist":
      return (a, b) =>
        a.artistSort.localeCompare(b.artistSort) ||
        nullsLast(a.year, b.year, 1) ||
        a.title.localeCompare(b.title);
    case "year_asc":
      return (a, b) =>
        nullsLast(a.year, b.year, 1) || a.artistSort.localeCompare(b.artistSort);
    case "year_desc":
      return (a, b) =>
        nullsLast(a.year, b.year, -1) || a.artistSort.localeCompare(b.artistSort);
    case "added":
      return (a, b) => b.addedAt.localeCompare(a.addedAt);
    case "custom":
    default:
      return (a, b) =>
        nullsLast(a.customOrder, b.customOrder, 1) ||
        a.artistSort.localeCompare(b.artistSort) ||
        a.title.localeCompare(b.title);
  }
}

export function applyFilters(
  records: RecordDTO[],
  filters: GalleryFilters
): RecordDTO[] {
  let pool = records;

  // `recent` se prend sur la collection entiere, avant tout autre filtre :
  // c'est "les N derniers ajouts", pas "les N derniers parmi les resultats".
  if (filters.recentEnabled && filters.recentCount > 0) {
    pool = [...pool]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, filters.recentCount);
  }

  const needle = filters.q.trim().toLowerCase();
  const wanted = filters.genres.length > 0 ? new Set(filters.genres) : null;

  const out = pool.filter((r) => {
    if (needle && !r.searchText.includes(needle)) return false;
    if (filters.format === "vinyl" && r.format !== "VINYL") return false;
    if (filters.format === "cd" && r.format !== "CD") return false;
    if (filters.favorites && !r.isFavorite) return false;
    if (wanted) {
      const hit =
        r.genres.some((g) => wanted.has(g)) || r.styles.some((s) => wanted.has(s));
      if (!hit) return false;
    }
    return true;
  });

  return out.sort(compare(filters.sort));
}
