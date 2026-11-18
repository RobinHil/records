/*
 * Mise en page de l'affiche, en millimetres.
 *
 * Tout est calcule dans l'unite du papier : l'apercu a l'ecran, l'impression
 * et l'export en JPEG partent des memes cotes, convertis chacun a leur
 * echelle. Ce qui s'affiche est donc exactement ce qui sort.
 */

export interface Paper {
  id: string;
  label: string;
  /** Format portrait, en millimetres. */
  width: number;
  height: number;
}

export const PAPERS: Paper[] = [
  { id: "a3", label: "A3", width: 297, height: 420 },
  { id: "a2", label: "A2", width: 420, height: 594 },
  { id: "a1", label: "A1", width: 594, height: 841 },
  { id: "50x70", label: "50 x 70 cm", width: 500, height: 700 },
  { id: "61x91", label: "24 x 36 in", width: 610, height: 914 },
];

export type Orientation = "portrait" | "landscape";

/**
 * Sens dans lequel le degrade de couleurs parcourt la grille : ligne par
 * ligne, colonne par colonne, ou en diagonale depuis le coin superieur gauche.
 */
export type Flow = "rows" | "columns" | "diagonal";

export interface LayoutOptions {
  paper: Paper;
  orientation: Orientation;
  /** Marge exterieure, en millimetres. */
  margin: number;
  /** Espace entre deux pochettes, en millimetres. */
  gap: number;
  flow: Flow;
  caption: boolean;
}

export interface PosterLayout {
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** Cote d'une pochette. */
  tile: number;
  /** Coin superieur gauche de chaque case, dans l'ordre du degrade. */
  cells: { x: number; y: number }[];
  /** Centre vertical et corps de la legende, ou null sans legende. */
  caption: { y: number; size: number } | null;
}

// Une grille qui laisse moins de cases vides vaut une pochette un peu plus
// petite : on accepte jusqu'a 4 % de cote en moins pour en gagner.
const TILE_TOLERANCE = 0.96;

// La grille se choisit par le nombre de cases de la ligne que le degrade
// parcourt en premier : remplie colonne par colonne, une grille choisie par
// son nombre de colonnes pourrait finir sur une colonne entierement vide.
function chooseGrid(
  n: number,
  width: number,
  height: number,
  gap: number,
  byColumns: boolean
) {
  let candidates: { cols: number; rows: number; tile: number; holes: number }[] = [];
  for (let line = 1; line <= n; line++) {
    const cols = byColumns ? Math.ceil(n / line) : line;
    const rows = byColumns ? line : Math.ceil(n / line);
    const tile = Math.min(
      (width - (cols - 1) * gap) / cols,
      (height - (rows - 1) * gap) / rows
    );
    if (tile > 0) candidates.push({ cols, rows, tile, holes: rows * cols - n });
  }
  if (candidates.length === 0) return { cols: 1, rows: n, tile: 0 };
  const best = Math.max(...candidates.map((c) => c.tile));
  candidates = candidates.filter((c) => c.tile >= best * TILE_TOLERANCE);
  candidates.sort((a, b) => a.holes - b.holes || b.tile - a.tile);
  return candidates[0];
}

export function computeLayout(n: number, options: LayoutOptions): PosterLayout {
  const { paper, orientation, margin, gap, flow } = options;
  const width = orientation === "portrait" ? paper.width : paper.height;
  const height = orientation === "portrait" ? paper.height : paper.width;

  // La legende prend une bande sous la grille, proportionnelle au papier.
  const captionSize = Math.min(width, height) * 0.016;
  const band = options.caption ? captionSize * 4 : 0;

  const areaW = width - 2 * margin;
  const areaH = height - 2 * margin - band;
  const count = Math.max(n, 1);
  const { cols, rows, tile } = chooseGrid(
    count,
    areaW,
    Math.max(areaH, 1),
    gap,
    flow === "columns"
  );

  const gridW = cols * tile + (cols - 1) * gap;
  const gridH = rows * tile + (rows - 1) * gap;
  // La grille et sa legende sont centrees ensemble dans la page.
  const x0 = margin + (areaW - gridW) / 2;
  const y0 = margin + (height - 2 * margin - gridH - band) / 2;
  const step = tile + gap;

  const order: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push([c, r]);
  if (flow === "columns") order.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (flow === "diagonal") order.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[1] - q[1]);

  const cells = order.slice(0, n).map(([c, r]) => ({ x: x0 + c * step, y: y0 + r * step }));

  // Une derniere ligne (ou colonne) incomplete est centree plutot que calee a
  // gauche (ou en haut). En diagonale, les cases vides restent dans le coin.
  const missing = rows * cols - n;
  if (missing > 0 && flow !== "diagonal") {
    const lineLength = flow === "rows" ? cols : rows;
    const lastLine = lineLength - missing;
    const shift = ((lineLength - lastLine) * step) / 2;
    for (const cell of cells.slice(n - lastLine)) {
      if (flow === "rows") cell.x += shift;
      else cell.y += shift;
    }
  }

  return {
    width,
    height,
    cols,
    rows,
    tile,
    cells,
    caption: options.caption ? { y: y0 + gridH + band / 2, size: captionSize } : null,
  };
}
