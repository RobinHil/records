export type RecordFormat = "VINYL" | "CD" | "OTHER";

export interface Track {
  position: string;
  title: string;
  duration: string;
}

export interface RecordDTO {
  /** Identifiant Discogs de l'exemplaire : unique, stable, et deja la cle du
   *  fichier d'etat. Il n'y a plus d'identifiant de base de donnees. */
  instanceId: number;
  releaseId: number;
  title: string;
  artist: string;
  year: number | null;
  format: RecordFormat;
  formatDetail: string | null;
  label: string | null;
  catalogNumber: string | null;
  country: string | null;
  genres: string[];
  styles: string[];
  tracklist: Track[] | null;
  coverSrc: string | null;
  discogsUrl: string | null;
  addedAt: string;
  isFavorite: boolean;
  customOrder: number | null;
  // Colonnes de tri et de recherche de la base, exposees parce que le
  // filtrage se fait desormais dans le navigateur : searchText est deja en
  // minuscules, artistSort est l'artiste sans son article initial.
  searchText: string;
  artistSort: string;
}

/**
 * Ce que le build ecrit dans collection.json : la collection entiere, et la
 * liste des genres deja dedoublonnee et triee.
 *
 * Les disques archives n'y figurent pas. La suppression douce sert a ne pas
 * perdre les favoris ni l'ordre manuel d'un disque retire puis remis dans la
 * collection Discogs ; elle n'a aucune raison d'etre publiee.
 */
export interface Collection {
  records: RecordDTO[];
  genres: string[];
  generatedAt: string;
}

export type SortKey =
  | "custom"
  | "album"
  | "artist"
  | "year_asc"
  | "year_desc"
  | "added";

export type FormatFilter = "vinyl" | "cd" | "both";
