import { existsSync } from "node:fs";
import {
  readLibrary,
  writeLibrary,
  type Library,
  type LibraryRecord,
} from "@/lib/library";
import {
  fetchFullCollection,
  fetchRelease,
  joinArtists,
  sortableArtist,
  detectFormat,
  releaseUrl,
  type DiscogsCollectionItem,
} from "@/lib/discogs";
import { coverFileName, coverPath, downloadCover, removeCover } from "@/lib/covers";

export interface SyncResult {
  added: number;
  updated: number;
  archived: number;
  restored: number;
  total: number;
  details: number;
  covers: number;
}

/** Les champs qui viennent de Discogs, et que la synchronisation rafraichit. */
type DiscogsFields = Pick<
  LibraryRecord,
  | "instanceId" | "releaseId" | "title" | "artist" | "artistSort" | "searchText"
  | "year" | "format" | "formatDetail" | "label" | "catalogNumber"
  | "genres" | "styles" | "coverUrl" | "discogsUrl" | "addedAt"
>;

function mapItem(item: DiscogsCollectionItem): DiscogsFields {
  const info = item.basic_information;
  const artist = joinArtists(info.artists);
  const title = info.title.trim();
  return {
    instanceId: item.instance_id,
    releaseId: info.id,
    title,
    artist,
    artistSort: sortableArtist(artist),
    searchText: `${title} ${artist}`.toLowerCase(),
    year: info.year > 0 ? info.year : null,
    format: detectFormat(info.formats),
    formatDetail:
      info.formats
        .map((f) =>
          [f.name, ...(f.descriptions ?? [])].filter(Boolean).join(", ")
        )
        .join(" / ") || null,
    label: info.labels[0]?.name?.replace(/\s+\(\d+\)$/, "") ?? null,
    catalogNumber: info.labels[0]?.catno || null,
    genres: info.genres ?? [],
    styles: info.styles ?? [],
    coverUrl: info.cover_image || null,
    discogsUrl: releaseUrl(info.id),
    addedAt: new Date(item.date_added).toISOString(),
  };
}

/**
 * Synchronise data/collection.json avec la collection Discogs.
 *
 * Tout ce qui coute un appel reseau est fait une seule fois par disque, jamais
 * deux : c'est le fichier d'etat, versionne, qui s'en souvient d'une execution
 * a l'autre. Discogs est appele a 1,1 seconde d'intervalle, retelecharger une
 * collection entiere chaque nuit prendrait des dizaines de minutes pour rien.
 */
export async function runSync(): Promise<SyncResult> {
  const library = await readLibrary();
  const collection = await fetchFullCollection();
  const now = new Date().toISOString();

  const byInstanceId = new Map(library.records.map((r) => [r.instanceId, r]));
  const seen = new Set<number>();
  const result: SyncResult = {
    added: 0,
    updated: 0,
    archived: 0,
    restored: 0,
    total: collection.length,
    details: 0,
    covers: 0,
  };

  for (const item of collection) {
    const fields = mapItem(item);
    seen.add(fields.instanceId);
    const prev = byInstanceId.get(fields.instanceId);

    if (!prev) {
      byInstanceId.set(fields.instanceId, {
        ...fields,
        country: null,
        tracklist: null,
        coverFile: null,
        archivedAt: null,
        isFavorite: false,
        customOrder: null,
      });
      result.added += 1;
    } else {
      if (prev.archivedAt) result.restored += 1;
      else result.updated += 1;
      // mapItem ne produit que les champs Discogs : le favori, l'ordre manuel,
      // la tracklist, le pays et la pochette deja prise survivent a l'ecrasement.
      Object.assign(prev, fields, { archivedAt: null });
    }
  }

  const live = [...byInstanceId.values()].filter((r) => !r.archivedAt);

  // Tracklist et pays viennent d'un point d'entree par sortie, bien plus cher
  // que la collection elle-meme : on ne le demande que pour les disques qui ne
  // l'ont jamais eu.
  for (const rec of live.filter((r) => r.tracklist === null)) {
    try {
      const release = await fetchRelease(rec.releaseId);
      rec.country = release.country ?? null;
      rec.tracklist = (release.tracklist ?? [])
        .filter((t) => t.type_ === "track" || !t.type_)
        .map((t) => ({
          position: t.position,
          title: t.title,
          duration: t.duration,
        }));
      result.details += 1;
    } catch (e) {
      console.error(`[sync] release ${rec.releaseId} details failed:`, e);
    }
  }

  // Les pochettes sont mises en cache localement pour que le site ne pointe
  // jamais vers Discogs. Elles ne sont pas versionnees : le nom enregistre ne
  // suffit donc pas, il faut verifier que le fichier est bien la.
  for (const rec of live.filter((r) => r.coverUrl)) {
    const url = rec.coverUrl as string;
    const expected = coverFileName(rec.instanceId, url);
    if (rec.coverFile === expected && existsSync(coverPath(expected))) continue;
    try {
      const file = await downloadCover(rec.instanceId, url);
      if (rec.coverFile && rec.coverFile !== file) await removeCover(rec.coverFile);
      rec.coverFile = file;
      result.covers += 1;
    } catch (e) {
      console.error(`[sync] cover for ${rec.instanceId} failed:`, e);
    }
  }

  // Suppression douce de ce qui a quitte la collection Discogs : le favori et
  // l'ordre manuel d'un disque retire puis remis sont ainsi preserves.
  for (const rec of byInstanceId.values()) {
    if (!seen.has(rec.instanceId) && !rec.archivedAt) {
      rec.archivedAt = now;
      result.archived += 1;
    }
  }

  const next: Library = { syncedAt: now, records: [...byInstanceId.values()] };
  await writeLibrary(next);
  return result;
}
