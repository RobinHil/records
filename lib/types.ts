export type RecordFormat = "VINYL" | "CD" | "OTHER";

export interface Track {
  position: string;
  title: string;
  duration: string;
}

export interface RecordDTO {
  id: number;
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
  archived: boolean;
}

export interface RecordsPage {
  items: RecordDTO[];
  total: number;
  page: number;
  perPage: number;
}

export type SortKey =
  | "custom"
  | "album"
  | "artist"
  | "year_asc"
  | "year_desc"
  | "added";

export type FormatFilter = "vinyl" | "cd" | "both";

export interface SyncLogDTO {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error";
  added: number;
  updated: number;
  archived: number;
  restored: number;
  total: number;
  error: string | null;
}

export interface SyncStatus {
  running: boolean;
  lastSync: SyncLogDTO | null;
  logs: SyncLogDTO[];
}
