import { readLibrary, type LibraryRecord } from "@/lib/library";
import type { Collection, RecordDTO } from "@/lib/types";

/*
 * Ce que le build publie, a partir de l'etat versionne.
 *
 * Il y avait ici une couche de requetes SQL - recherche, filtres, tri,
 * pagination - appelee a chaque frappe depuis la galerie. Le site est
 * statique : le build ecrit la collection entiere dans un fichier et c'est le
 * navigateur qui filtre et trie (components/gallery/filtering.ts).
 */

function toDTO(r: LibraryRecord, basePath: string): RecordDTO {
  return {
    instanceId: r.instanceId,
    releaseId: r.releaseId,
    title: r.title,
    artist: r.artist,
    year: r.year,
    format: r.format,
    formatDetail: r.formatDetail,
    label: r.label,
    catalogNumber: r.catalogNumber,
    country: r.country,
    genres: r.genres,
    styles: r.styles,
    tracklist: r.tracklist,
    // Les pochettes sont des fichiers de public/covers, copies tels quels dans
    // la sortie. Le chemin de base est incorpore ici, au build : le composant
    // qui les affiche n'a ainsi rien a savoir du deploiement.
    coverSrc: r.coverFile ? `${basePath}/covers/${r.coverFile}` : r.coverUrl,
    discogsUrl: r.discogsUrl,
    addedAt: r.addedAt,
    isFavorite: r.isFavorite,
    customOrder: r.customOrder,
    searchText: r.searchText,
    artistSort: r.artistSort,
  };
}

/**
 * La collection vivante et ses genres.
 *
 * L'ordre du tableau n'a pas d'importance : la galerie trie toujours
 * elle-meme, selon le tri choisi, dont "custom" par defaut. Les disques
 * sortent donc dans l'ordre du fichier, qui est celui des instanceId - stable,
 * donc sans diff parasite d'un build a l'autre.
 */
export async function loadCollection(basePath = ""): Promise<Collection> {
  const library = await readLibrary();
  const live = library.records.filter((r) => r.archivedAt === null);

  const genres = new Set<string>();
  for (const r of live) {
    for (const g of r.genres) genres.add(g);
    for (const s of r.styles) genres.add(s);
  }

  return {
    records: live.map((r) => toDTO(r, basePath)),
    genres: [...genres].sort((a, b) => a.localeCompare(b)),
    generatedAt: new Date().toISOString(),
  };
}
