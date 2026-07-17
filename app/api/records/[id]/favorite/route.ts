import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const recordId = Number(id);
  if (!Number.isInteger(recordId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const { isFavorite } = (await request.json().catch(() => ({}))) as {
    isFavorite?: boolean;
  };
  if (typeof isFavorite !== "boolean") {
    return NextResponse.json({ error: "isFavorite must be a boolean" }, { status: 400 });
  }
  try {
    const record = await prisma.record.update({
      where: { id: recordId },
      data: { isFavorite },
      select: { id: true, isFavorite: true },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
}
