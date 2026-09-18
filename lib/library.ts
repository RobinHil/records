import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { RecordFormat, Track } from "@/lib/types";

/*
 * L'etat de la collection, dans un fichier du depot.
 *
 * C'etait une base SQLite derriere Prisma. Le site etant devenu statique, la
 * base n'avait plus de serveur pour la tenir : elle aurait ete recreee vide a
 * chaque deploiement, et une base vide casse tout ce que la synchronisation
 * construit par comparaison avec l'etat precedent - rien n'aurait jamais ete
 * archive, et chaque nuit aurait retelecharge toutes les tracklists et toutes
 * les pochettes, a 1,1 seconde par appel Discogs.
 *
 * L'etat vit donc ici, versionne. Ce que Discogs ignore - les favoris et
 * l'ordre manuel - s'edite directement dans ce fichier, et la synchronisation
 * le preserve.
 */

export const LIBRARY_PATH = "data/collection.json";

export interface LibraryRecord {
  instanceId: number;
  releaseId: number;
  title: string;
  artist: string;
  artistSort: string;
  searchText: string;
  year: number | null;
  format: RecordFormat;
  formatDetail: string | null;
  label: string | null;
  catalogNumber: string | null;
  country: string | null;
  genres: string[];
  styles: string[];
  discogsUrl: string | null;
  addedAt: string;
  coverUrl: string | null;
  /** Nom du fichier dans public/covers, ou null tant qu'il n'a pas ete pris. */
  coverFile: string | null;
  /** Tracklist, recuperee une seule fois par disque. */
  tracklist: Track[] | null;
  /** Suppression douce : le disque a quitte la collection Discogs. */
  archivedAt: string | null;
  /** Ce que Discogs ne connait pas, et qui s'edite a la main ici. */
  isFavorite: boolean;
  customOrder: number | null;
}

export interface Library {
  syncedAt: string | null;
  records: LibraryRecord[];
}

const EMPTY: Library = { syncedAt: null, records: [] };

export async function readLibrary(file = LIBRARY_PATH): Promise<Library> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Library;
    return { syncedAt: parsed.syncedAt ?? null, records: parsed.records ?? [] };
  } catch (e) {
    // Fichier absent au tout premier usage : on part d'une bibliotheque vide.
    // Un fichier present mais illisible, en revanche, doit arreter le build
    // plutot que d'etre silencieusement remplace par du vide.
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
    throw new Error(`${file} est illisible : ${(e as Error).message}`);
  }
}

/**
 * Reecrit le fichier d'etat.
 *
 * Les disques sont tries par instanceId et les cles de chacun ecrites dans un
 * ordre fixe : le fichier est relu par un humain et committe a chaque
 * synchronisation, son diff doit ne montrer que ce qui a reellement change.
 */
export async function writeLibrary(
  library: Library,
  file = LIBRARY_PATH
): Promise<void> {
  const records = [...library.records].sort((a, b) => a.instanceId - b.instanceId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    JSON.stringify({ syncedAt: library.syncedAt, records }, null, 2) + "\n",
    "utf8"
  );
}
