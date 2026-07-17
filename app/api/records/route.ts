import { NextResponse } from "next/server";
import { queryRecords } from "@/lib/records";
import type { FormatFilter, SortKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: SortKey[] = [
  "custom",
  "album",
  "artist",
  "year_asc",
  "year_desc",
  "added",
];
const FORMATS: FormatFilter[] = ["vinyl", "cd", "both"];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const sortParam = params.get("sort") as SortKey | null;
  const formatParam = params.get("format") as FormatFilter | null;
  const recentParam = Number(params.get("recent"));

  const page = await queryRecords({
    q: params.get("q")?.trim() || undefined,
    format: formatParam && FORMATS.includes(formatParam) ? formatParam : "both",
    genres: params.get("genres")?.split("|").filter(Boolean) ?? [],
    favorites: params.get("favorites") === "1",
    recent: Number.isFinite(recentParam) && recentParam > 0 ? recentParam : undefined,
    sort: sortParam && SORTS.includes(sortParam) ? sortParam : "custom",
    page: Math.max(1, Number(params.get("page")) || 1),
    perPage: Math.max(1, Number(params.get("perPage")) || 120),
  });

  return NextResponse.json(page);
}
