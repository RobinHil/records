import type { PosterLayout } from "@/components/poster/layout";

/*
 * L'affiche rendue en JPEG, a la resolution d'impression.
 *
 * 300 dpi est la norme des tireurs photo. Les navigateurs plafonnent pourtant
 * la taille d'un canvas : au-dela d'environ 16 000 pixels de cote ou de
 * quelques centaines de megapixels, il reste blanc sans lever d'erreur. La
 * resolution descend donc d'elle-meme sur les plus grands formats, et le
 * fichier annonce celle qu'il a vraiment.
 *
 * Les pochettes Discogs font au plus 600 pixels : au-dela de quelques
 * centimetres de cote, c'est elles qui limitent la nettete, pas ce fichier.
 */

const TARGET_DPI = 300;
const MAX_SIDE = 16000;
const MAX_AREA = 120_000_000;

export function exportDpi(layout: PosterLayout): number {
  const wIn = layout.width / 25.4;
  const hIn = layout.height / 25.4;
  return Math.floor(
    Math.min(TARGET_DPI, MAX_SIDE / Math.max(wIn, hIn), Math.sqrt(MAX_AREA / (wIn * hIn)))
  );
}

/**
 * Inscrit la resolution dans l'en-tete JFIF, que les canvas laissent a 1:1
 * sans unite : sans elle, un logiciel d'impression ouvre le fichier a 72 dpi
 * et propose une affiche de plusieurs metres.
 */
function withDensity(buffer: ArrayBuffer, dpi: number): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  const jfif = [0x4a, 0x46, 0x49, 0x46, 0x00];
  if (bytes[2] !== 0xff || bytes[3] !== 0xe0) return buffer;
  if (!jfif.every((b, i) => bytes[6 + i] === b)) return buffer;
  bytes[13] = 1; // unite : pouces
  bytes[14] = dpi >> 8;
  bytes[15] = dpi & 0xff;
  bytes[16] = dpi >> 8;
  bytes[17] = dpi & 0xff;
  return buffer;
}

export async function renderPoster(
  layout: PosterLayout,
  images: HTMLImageElement[],
  options: { background: string; ink: string; caption: string; fontFamily: string }
): Promise<{ blob: Blob; dpi: number }> {
  const dpi = exportDpi(layout);
  const scale = dpi / 25.4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d indisponible");

  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const side = layout.tile * scale;
  layout.cells.forEach((cell, i) => {
    const img = images[i];
    if (!img) return;
    // Recadrage carre au centre, comme object-fit: cover a l'ecran.
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const crop = Math.min(w, h);
    ctx.drawImage(
      img,
      (w - crop) / 2,
      (h - crop) / 2,
      crop,
      crop,
      cell.x * scale,
      cell.y * scale,
      side,
      side
    );
  });

  if (layout.caption && options.caption) {
    const size = layout.caption.size * scale;
    ctx.fillStyle = options.ink;
    ctx.font = `600 ${size}px ${options.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // L'espacement s'ajoute aussi apres la derniere lettre : le texte est
    // decale d'autant pour rester centre.
    const spacing = "letterSpacing" in ctx ? size * 0.35 : 0;
    if (spacing) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(
      options.caption.toUpperCase(),
      canvas.width / 2 + spacing / 2,
      layout.caption.y * scale
    );
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("export JPEG impossible"))),
      "image/jpeg",
      0.92
    )
  );
  // Plusieurs centaines de megaoctets : rendus tout de suite, sans attendre
  // que le ramasse-miettes s'apercoive que le canvas n'est plus reference.
  canvas.width = 0;
  canvas.height = 0;
  const buffer = withDensity(await blob.arrayBuffer(), dpi);
  return { blob: new Blob([buffer], { type: "image/jpeg" }), dpi };
}
