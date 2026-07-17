import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fetchImage } from "@/lib/discogs";

export function coversDir(): string {
  return process.env.COVERS_DIR || "./data/covers";
}

// Runtime data directory (Docker volume) - excluded from build-time file
// tracing on purpose.
export function coverPath(file: string): string {
  return path.join(/*turbopackIgnore: true*/ coversDir(), file);
}

function hash8(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

export function coverFileName(instanceId: number | bigint, url: string): string {
  const ext = url.split("?")[0].toLowerCase().endsWith(".png") ? "png" : "jpg";
  return `${instanceId}-${hash8(url)}.${ext}`;
}

export async function downloadCover(
  instanceId: number | bigint,
  url: string
): Promise<string> {
  const dir = coversDir();
  await mkdir(dir, { recursive: true });
  const file = coverFileName(instanceId, url);
  const buf = await fetchImage(url);
  await writeFile(coverPath(file), Buffer.from(buf));
  return file;
}

export async function removeCover(file: string | null) {
  if (!file) return;
  try {
    await unlink(coverPath(file));
  } catch {
    // already gone
  }
}
