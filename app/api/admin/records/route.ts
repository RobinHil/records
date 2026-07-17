import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toDTO } from "@/lib/records";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// Full collection for the admin list view, archived records included,
// in custom order (the order used by drag & drop).
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.record.findMany({
    orderBy: [
      { archivedAt: { sort: "asc", nulls: "first" } },
      { customOrder: { sort: "asc", nulls: "last" } },
      { artistSort: "asc" },
      { title: "asc" },
    ],
  });
  return NextResponse.json({ items: rows.map(toDTO) });
}
