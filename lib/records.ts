import type { Prisma, Record as DbRecord } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  FormatFilter,
  RecordDTO,
  RecordsPage,
  SortKey,
  Track,
} from "@/lib/types";

export function toDTO(r: DbRecord): RecordDTO {
  return {
    id: r.id,
    // BigInt columns; Discogs ids stay well under 2^53 so Number is safe
    instanceId: Number(r.instanceId),
    releaseId: Number(r.releaseId),
    title: r.title,
    artist: r.artist,
    year: r.year,
    format: r.format as RecordDTO["format"],
    formatDetail: r.formatDetail,
    label: r.label,
    catalogNumber: r.catalogNumber,
    country: r.country,
    genres: JSON.parse(r.genres) as string[],
    styles: JSON.parse(r.styles) as string[],
    tracklist: r.tracklist ? (JSON.parse(r.tracklist) as Track[]) : null,
    coverSrc: r.coverFile ? `/api/covers/${r.coverFile}` : r.coverUrl,
    discogsUrl: r.discogsUrl,
    addedAt: r.addedAt.toISOString(),
    isFavorite: r.isFavorite,
    customOrder: r.customOrder,
    archived: r.archivedAt !== null,
  };
}

export interface RecordsQuery {
  q?: string;
  format?: FormatFilter;
  genres?: string[];
  favorites?: boolean;
  recent?: number;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

function orderBy(
  sort: SortKey
): Prisma.RecordOrderByWithRelationInput[] {
  switch (sort) {
    case "album":
      return [{ title: "asc" }, { artistSort: "asc" }];
    case "artist":
      return [{ artistSort: "asc" }, { year: "asc" }, { title: "asc" }];
    case "year_asc":
      return [{ year: { sort: "asc", nulls: "last" } }, { artistSort: "asc" }];
    case "year_desc":
      return [{ year: { sort: "desc", nulls: "last" } }, { artistSort: "asc" }];
    case "added":
      return [{ addedAt: "desc" }];
    case "custom":
    default:
      return [
        { customOrder: { sort: "asc", nulls: "last" } },
        { artistSort: "asc" },
        { title: "asc" },
      ];
  }
}

export async function queryRecords(query: RecordsQuery): Promise<RecordsPage> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(500, Math.max(1, query.perPage ?? 120));

  const where: Prisma.RecordWhereInput = { archivedAt: null };

  if (query.q) {
    where.searchText = { contains: query.q.toLowerCase() };
  }
  if (query.format === "vinyl") where.format = "VINYL";
  if (query.format === "cd") where.format = "CD";
  if (query.favorites) where.isFavorite = true;
  if (query.genres && query.genres.length > 0) {
    // genres/styles are stored as JSON arrays; a quoted substring match is an
    // exact element match ("Rock" will not match "Post Rock").
    where.OR = query.genres.flatMap((g) => {
      const needle = JSON.stringify(g);
      return [{ genres: { contains: needle } }, { styles: { contains: needle } }];
    });
  }
  if (query.recent && query.recent > 0) {
    const newest = await prisma.record.findMany({
      where: { archivedAt: null },
      orderBy: { addedAt: "desc" },
      take: query.recent,
      select: { id: true },
    });
    where.id = { in: newest.map((r) => r.id) };
  }

  const [total, rows] = await Promise.all([
    prisma.record.count({ where }),
    prisma.record.findMany({
      where,
      orderBy: orderBy(query.sort ?? "custom"),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return { items: rows.map(toDTO), total, page, perPage };
}

export async function listGenres(): Promise<string[]> {
  const rows = await prisma.record.findMany({
    where: { archivedAt: null },
    select: { genres: true, styles: true },
  });
  const set = new Set<string>();
  for (const row of rows) {
    for (const g of JSON.parse(row.genres) as string[]) set.add(g);
    for (const s of JSON.parse(row.styles) as string[]) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
