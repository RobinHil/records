import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fetchImage } from "@/lib/discogs";

// Les pochettes sont telechargees dans public/, d'ou Next les copie telles
// quelles dans la sortie statique : elles deviennent des fichiers du site,
// servis sous /covers/, et ne transitent plus par une route d'API.
//
// Elles n'entrent pas dans git : la synchronisation les retelecharge, et une
// collection entiere de pochettes ferait grossir le depot pour rien.
export function coversDir(): string {
  return process.env.COVERS_DIR || "./public/covers";
}

export function coverPath(file: string): string {
  return path.join(coversDir(), file);
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
