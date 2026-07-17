import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// PUT: persist a manual ordering (array of record ids in display order).
export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderedIds } = (await request.json().catch(() => ({}))) as {
    orderedIds?: number[];
  };
  if (!Array.isArray(orderedIds) || orderedIds.some((n) => !Number.isInteger(n))) {
    return NextResponse.json(
      { error: "orderedIds must be an array of record ids" },
      { status: 400 }
    );
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.record.update({ where: { id }, data: { customOrder: index } })
    )
  );
  return NextResponse.json({ ok: true, count: orderedIds.length });
}

// POST: reset the custom order from an automatic sort as a starting point.
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { basedOn } = (await request.json().catch(() => ({}))) as {
    basedOn?: string;
  };
  if (!basedOn || !["album", "artist", "year"].includes(basedOn)) {
    return NextResponse.json(
      { error: "basedOn must be one of: album, artist, year" },
      { status: 400 }
    );
  }
  const orderBy =
    basedOn === "album"
      ? [{ title: "asc" as const }, { artistSort: "asc" as const }]
      : basedOn === "artist"
        ? [
            { artistSort: "asc" as const },
            { year: "asc" as const },
            { title: "asc" as const },
          ]
        : [
            { year: { sort: "asc" as const, nulls: "last" as const } },
            { artistSort: "asc" as const },
          ];

  const records = await prisma.record.findMany({
    where: { archivedAt: null },
    orderBy,
    select: { id: true },
  });
  await prisma.$transaction(
    records.map((r, index) =>
      prisma.record.update({ where: { id: r.id }, data: { customOrder: index } })
    )
  );
  return NextResponse.json({ ok: true, count: records.length });
}
