import { prisma } from "@/lib/db";
import {
  fetchFullCollection,
  fetchRelease,
  joinArtists,
  sortableArtist,
  detectFormat,
  releaseUrl,
  type DiscogsCollectionItem,
} from "@/lib/discogs";
import { coverFileName, downloadCover, removeCover } from "@/lib/covers";

let syncRunning = false;

export function isSyncRunning() {
  return syncRunning;
}

interface SyncResult {
  added: number;
  updated: number;
  archived: number;
  restored: number;
  total: number;
}

function mapItem(item: DiscogsCollectionItem) {
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
    genres: JSON.stringify(info.genres ?? []),
    styles: JSON.stringify(info.styles ?? []),
    coverUrl: info.cover_image || null,
    discogsUrl: releaseUrl(info.id),
    addedAt: new Date(item.date_added),
  };
}

export async function runSync(): Promise<SyncResult> {
  if (syncRunning) throw new Error("A sync is already running");
  syncRunning = true;
  const log = await prisma.syncLog.create({ data: {} });

  try {
    const collection = await fetchFullCollection();
    const now = new Date();
    const result: SyncResult = {
      added: 0,
      updated: 0,
      archived: 0,
      restored: 0,
      total: collection.length,
    };

    const existing = await prisma.record.findMany({
      select: {
        id: true,
        instanceId: true,
        coverUrl: true,
        coverFile: true,
        tracklist: true,
        archivedAt: true,
      },
    });
    const byInstanceId = new Map(existing.map((r) => [Number(r.instanceId), r]));
    const seen = new Set<number>();

    for (const item of collection) {
      const data = mapItem(item);
      seen.add(data.instanceId);
      const prev = byInstanceId.get(data.instanceId);

      if (!prev) {
        await prisma.record.create({
          data: { ...data, syncedAt: now },
        });
        result.added += 1;
      } else {
        if (prev.archivedAt) result.restored += 1;
        else result.updated += 1;
        await prisma.record.update({
          where: { instanceId: data.instanceId },
          data: { ...data, syncedAt: now, archivedAt: null },
        });
      }
    }

    // Details (tracklist, country) come from a per-release endpoint; only
    // fetch them for records that never got them, to spare the rate limit.
    const needDetails = await prisma.record.findMany({
      where: { archivedAt: null, tracklist: null },
      select: { instanceId: true, releaseId: true },
    });
    for (const rec of needDetails) {
      try {
        const release = await fetchRelease(rec.releaseId);
        await prisma.record.update({
          where: { instanceId: rec.instanceId },
          data: {
            country: release.country ?? null,
            tracklist: JSON.stringify(
              (release.tracklist ?? [])
                .filter((t) => t.type_ === "track" || !t.type_)
                .map((t) => ({
                  position: t.position,
                  title: t.title,
                  duration: t.duration,
                }))
            ),
          },
        });
      } catch (e) {
        console.error(`[sync] release ${rec.releaseId} details failed:`, e);
      }
    }

    // Cache covers locally so the UI never hotlinks Discogs.
    const needCovers = await prisma.record.findMany({
      where: { archivedAt: null, coverUrl: { not: null } },
      select: { instanceId: true, coverUrl: true, coverFile: true },
    });
    for (const rec of needCovers) {
      const url = rec.coverUrl as string;
      const expected = coverFileName(rec.instanceId, url);
      if (rec.coverFile === expected) continue;
      try {
        const file = await downloadCover(rec.instanceId, url);
        await removeCover(rec.coverFile);
        await prisma.record.update({
          where: { instanceId: rec.instanceId },
          data: { coverFile: file },
        });
      } catch (e) {
        console.error(`[sync] cover for ${rec.instanceId} failed:`, e);
      }
    }

    // Soft-delete records that disappeared from the Discogs collection.
    const gone = existing.filter(
      (r) => !seen.has(Number(r.instanceId)) && !r.archivedAt
    );
    for (const rec of gone) {
      await prisma.record.update({
        where: { instanceId: rec.instanceId },
        data: { archivedAt: now },
      });
      result.archived += 1;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { ...result, status: "success", finishedAt: new Date() },
    });
    return result;
  } catch (e) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        error: e instanceof Error ? e.message : String(e),
      },
    });
    throw e;
  } finally {
    syncRunning = false;
  }
}
