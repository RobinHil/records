import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { isSyncRunning, runSync } from "@/lib/sync";
import type { SyncLogDTO, SyncStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function toLogDTO(log: {
  id: number;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  added: number;
  updated: number;
  archived: number;
  restored: number;
  total: number;
  error: string | null;
}): SyncLogDTO {
  return {
    ...log,
    status: log.status as SyncLogDTO["status"],
    startedAt: log.startedAt.toISOString(),
    finishedAt: log.finishedAt?.toISOString() ?? null,
  };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const logs = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  const lastFinished = logs.find((l) => l.status !== "running") ?? null;
  const status: SyncStatus = {
    running: isSyncRunning(),
    lastSync: lastFinished ? toLogDTO(lastFinished) : null,
    logs: logs.map(toLogDTO),
  };
  return NextResponse.json(status);
}

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isSyncRunning()) {
    return NextResponse.json({ error: "Sync already running" }, { status: 409 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
