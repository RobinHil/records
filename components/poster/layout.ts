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
  { id: "a4", label: "A4", width: 210, height: 297 },
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

/**
 * Place de la legende : une bande au-dessus ou en dessous de la grille, une
 * bande qui la coupe en deux, ou un cadre au centre que les pochettes
 * entourent.
 */
export type CaptionPosition = "top" | "bottom" | "band" | "framed";

/**
 * Taille des pochettes. "uniform" : toutes pareilles, et la grille laisse de
 * la marge la ou le nombre de pochettes ne tombe pas juste. "mixed" : la
 * grille remplit la page, et quelques pochettes prennent quatre cases pour
 * occuper ce qui resterait vide.
 */
export type Sizing = "uniform" | "mixed";

export interface LayoutOptions {
  paper: Paper;
  orientation: Orientation;
  /** Marge exterieure, en millimetres. */
  margin: number;
  /** Espace entre deux pochettes, en millimetres. */
  gap: number;
  flow: Flow;
  sizing: Sizing;
  /**
   * Graine de la forme de la mosaique, en mode "mixed" : 0 place les grandes
   * pochettes de facon reguliere, toute autre valeur les disperse autrement.
   */
  shapeSeed: number;
  caption: string;
  captionPosition: CaptionPosition;
  /**
   * Largeur de la legende pour un corps de 1, espacement compris. Mesuree
   * dans la vraie police par l'appelant ; a defaut, une estimation.
   */
  measure?: (text: string) => number;
}

export interface PosterLayout {
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** Cote d'une case. */
  tile: number;
  /** Chaque pochette, dans l'ordre du degrade : coin superieur gauche et cote. */
  cells: { x: number; y: number; size: number }[];
  /** Nombre de pochettes en double taille. */
  large: number;
  /** Centre et corps de la legende, ou null sans legende. */
  caption: { x: number; y: number; size: number } | null;
}

interface Block {
  c0: number;
  r0: number;
  cols: number;
  rows: number;
}

interface Grid {
  cols: number;
  rows: number;
  tile: number;
  block: Block | null;
  /** Coins superieurs gauches des pochettes en double taille. */
  large: [number, number][];
  holes: number;
}

// Une grille qui laisse moins de cases vides vaut une pochette un peu plus
// petite : on accepte jusqu'a 4 % de cote en moins pour en gagner. La meme
// tolerance, en surface, departage les grilles du mode "mixed".
const TOLERANCE = 0.96;

function tileFor(cols: number, rows: number, w: number, h: number, gap: number): number {
  return Math.min((w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows);
}

/**
 * Le cadre central de la legende : une rangee de cases (deux si le nombre de
 * rangees est pair, pour rester centre) et environ deux tiers des colonnes,
 * avec au moins une pochette de chaque cote. Null si la grille est trop
 * petite pour entourer quoi que ce soit.
 */
function frameBlock(cols: number, rows: number): Block | null {
  const blockRows = rows % 2 === 0 ? 2 : 1;
  if (cols < 3 || rows < blockRows + 2) return null;
  const side = Math.max(1, Math.floor(cols / 5));
  return { c0: side, r0: (rows - blockRows) / 2, cols: cols - 2 * side, rows: blockRows };
}

function inBlock(block: Block | null, c: number, r: number): boolean {
  return (
    !!block &&
    c >= block.c0 &&
    c < block.c0 + block.cols &&
    r >= block.r0 &&
    r < block.r0 + block.rows
  );
}

/** Generateur pseudo-aleatoire a graine (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Place jusqu'a `want` pochettes de quatre cases, aussi loin que possible
 * les unes des autres et des bords : chacune va la ou la distance a la plus
 * proche deja placee, ou au bord, est la plus grande. Elles ne chevauchent ni
 * le cadre de la legende ni la bande centrale.
 *
 * Avec `random`, chaque emplacement voit son score multiplie par un facteur
 * tire au sort : la repartition reste aeree, mais change a chaque graine.
 */
function placeLarge(
  cols: number,
  rows: number,
  block: Block | null,
  split: number | null,
  want: number,
  random?: () => number
): [number, number][] {
  const taken = new Set<number>();
  const placed: [number, number][] = [];
  const free = (c: number, r: number) => !inBlock(block, c, r) && !taken.has(r * cols + c);

  for (let i = 0; i < want; i++) {
    let best: [number, number] | null = null;
    let bestScore = -Infinity;
    for (let r = 0; r < rows - 1; r++) {
      if (split !== null && r === split - 1) continue;
      for (let c = 0; c < cols - 1; c++) {
        if (!free(c, r) || !free(c + 1, r) || !free(c, r + 1) || !free(c + 1, r + 1)) continue;
        const cx = c + 1;
        const cy = r + 1;
        let score = 1.5 * Math.min(cx, cols - cx, cy, rows - cy);
        for (const [pc, pr] of placed) score = Math.min(score, Math.hypot(cx - pc - 1, cy - pr - 1));
        if (random) score *= 0.25 + random();
        if (score > bestScore) {
          bestScore = score;
          best = [c, r];
        }
      }
    }
    if (!best) break;
    const [c, r] = best;
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) taken.add((r + dr) * cols + c + dc);
    placed.push(best);
  }
  return placed;
}

/**
 * Grille a cases toutes egales : la plus grande pochette possible, et parmi
 * les grilles presque aussi bonnes, celle qui laisse le moins de cases vides.
 *
 * Elle se choisit par le nombre de cases de la ligne que le degrade parcourt
 * en premier : remplie colonne par colonne, une grille choisie par son nombre
 * de colonnes pourrait finir sur une colonne entierement vide.
 */
function uniformGrid(
  n: number,
  w: number,
  h: number,
  gap: number,
  byColumns: boolean,
  framed: boolean
): Grid | null {
  let candidates: Grid[] = [];
  for (let line = 1; line <= n + 2; line++) {
    // L'autre dimension grandit jusqu'a loger n pochettes en plus du cadre.
    for (let other = Math.ceil(n / line); other <= n + 3; other++) {
      const cols = byColumns ? other : line;
      const rows = byColumns ? line : other;
      const block = framed ? frameBlock(cols, rows) : null;
      if (framed && !block) continue;
      const capacity = cols * rows - (block ? block.cols * block.rows : 0);
      if (capacity < n) continue;
      const tile = tileFor(cols, rows, w, h, gap);
      if (tile > 0) candidates.push({ cols, rows, tile, block, large: [], holes: capacity - n });
      break;
    }
  }
  if (candidates.length === 0) return null;
  const best = Math.max(...candidates.map((c) => c.tile));
  candidates = candidates.filter((c) => c.tile >= best * TOLERANCE);
  candidates.sort((a, b) => a.holes - b.holes || b.tile - a.tile);
  return candidates[0];
}

/**
 * Grille qui remplit la page : pour chaque nombre de colonnes, autant de
 * rangees que la hauteur en loge, et inversement. Les cases en trop sont
 * absorbees par des pochettes de quatre cases (chacune en occupe trois de
 * plus qu'une pochette simple), jamais plus d'une sur trois. Gagne la grille qui couvre la plus grande
 * surface ; a surface presque egale, celle qui laisse le moins de trous,
 * puis le moins de grandes pochettes.
 */
function mixedGrid(
  n: number,
  w: number,
  h: number,
  gap: number,
  framed: boolean,
  splitFor: (rows: number) => number | null,
  shapeSeed: number
): Grid | null {
  const pairs = new Map<string, [number, number]>();
  const add = (cols: number, rows: number) => {
    if (cols >= 1 && rows >= 1) pairs.set(`${cols}x${rows}`, [cols, rows]);
  };
  for (let k = 1; k <= n + 2; k++) {
    const byWidth = (w - (k - 1) * gap) / k;
    if (byWidth > 0) add(k, Math.floor((h + gap) / (byWidth + gap)));
    const byHeight = (h - (k - 1) * gap) / k;
    if (byHeight > 0) add(Math.floor((w + gap) / (byHeight + gap)), k);
    add(k, Math.ceil(n / k));
  }

  const fitting = [...pairs.values()]
    .map(([cols, rows]) => {
      const block = framed ? frameBlock(cols, rows) : null;
      const capacity = cols * rows - (block ? block.cols * block.rows : 0);
      return { cols, rows, block, capacity, tile: tileFor(cols, rows, w, h, gap) };
    })
    .filter((g) => (!framed || g.block) && g.capacity >= n && g.tile > 0);
  // Une case de moins de 68 % du cote de la meilleure ne peut pas gagner :
  // meme avec une grande pochette sur trois, elle couvre moins que la
  // meilleure grille sans aucune, tolerance comprise. Inutile d'y chercher la
  // place des grandes, qui est la partie couteuse.
  const maxTile = Math.max(0, ...fitting.map((g) => g.tile));

  const scored: (Grid & { area: number })[] = [];
  for (const { cols, rows, block, capacity, tile } of fitting) {
    if (tile < maxTile * 0.68) continue;
    const want = Math.min(Math.floor((capacity - n) / 3), Math.floor(n / 3));
    const large = placeLarge(cols, rows, block, splitFor(rows), want);
    const holes = capacity - n - 3 * large.length;
    const area = (capacity - holes) * tile * tile;
    scored.push({ cols, rows, tile, block, large, holes, area });
  }
  if (scored.length === 0) return null;
  const best = Math.max(...scored.map((g) => g.area));
  const chosen = scored
    .filter((g) => g.area >= best * TOLERANCE)
    .sort((a, b) => a.holes - b.holes || a.large.length - b.large.length || b.area - a.area)[0];

  // Une autre forme pour la meme grille. Un tirage malheureux peut morceler
  // la place au point de loger moins de grandes pochettes, et donc laisser
  // des trous : on retire, et a defaut on garde la forme reguliere.
  if (shapeSeed !== 0 && chosen.large.length > 0) {
    const random = seeded(shapeSeed);
    for (let attempt = 0; attempt < 20; attempt++) {
      const large = placeLarge(
        chosen.cols,
        chosen.rows,
        chosen.block,
        splitFor(chosen.rows),
        chosen.large.length,
        random
      );
      if (large.length === chosen.large.length) return { ...chosen, large };
    }
  }
  return chosen;
}

export function computeLayout(n: number, options: LayoutOptions): PosterLayout {
  const { paper, orientation, margin, gap, flow } = options;
  const width = orientation === "portrait" ? paper.width : paper.height;
  const height = orientation === "portrait" ? paper.height : paper.width;
  const text = options.caption.trim();
  const measure = options.measure ?? ((t: string) => t.length);
  const count = Math.max(n, 1);

  // Le corps de la legende suit le papier ; une bande lui laisse quatre fois
  // sa hauteur. Le cadre central n'a besoin d'aucune bande.
  const baseSize = Math.min(width, height) * 0.016;
  const areaW = width - 2 * margin;
  const fullH = height - 2 * margin;
  let position = text ? options.captionPosition : null;

  // Rangees au-dessus de la bande centrale : la moitie, arrondie vers le
  // bas, ce qui place le texte un peu au-dessus du centre, la ou l'oeil
  // l'attend.
  const splitFor = (rows: number) =>
    position === "band" ? Math.floor(rows / 2) : position === "top" ? 0 : rows;

  const choose = (h: number, framed: boolean) =>
    options.sizing === "mixed"
      ? mixedGrid(
          count,
          areaW,
          h,
          gap,
          framed,
          (rows) => (position === "band" ? splitFor(rows) : null),
          options.shapeSeed
        )
      : uniformGrid(count, areaW, h, gap, flow === "columns", framed);

  let grid = position === "framed" ? choose(fullH, true) : null;
  // Trop peu de pochettes pour en entourer la legende : elle passe en bande.
  if (position === "framed" && !grid) position = "band";
  const band = position && position !== "framed" ? baseSize * 4 : 0;
  grid ??= choose(Math.max(fullH - band, 1), false);
  const { cols, rows, tile, block, large } = grid ?? {
    cols: 1,
    rows: count,
    tile: 0,
    block: null,
    large: [],
  };

  const step = tile + gap;
  const gridW = cols * tile + (cols - 1) * gap;
  const gridH = rows * tile + (rows - 1) * gap;
  // La grille et sa legende sont centrees ensemble dans la page.
  const x0 = margin + (areaW - gridW) / 2;
  const y0 = margin + (fullH - gridH - band) / 2;
  const split = splitFor(rows);

  // Les pochettes, petites et grandes, ordonnees par leur centre selon le
  // sens du degrade.
  const covered = new Set<number>();
  for (const [c, r] of large) {
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) covered.add((r + dr) * cols + c + dc);
  }
  const units: { c: number; r: number; span: number }[] = large.map(([c, r]) => ({
    c,
    r,
    span: 2,
  }));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inBlock(block, c, r) && !covered.has(r * cols + c)) units.push({ c, r, span: 1 });
    }
  }
  const key = (u: { c: number; r: number; span: number }): [number, number] => {
    const cx = u.c + u.span / 2;
    const cy = u.r + u.span / 2;
    if (flow === "columns") return [cx, cy];
    if (flow === "diagonal") return [cx + cy, cy];
    return [cy, cx];
  };
  units.sort((p, q) => {
    const [p1, p2] = key(p);
    const [q1, q2] = key(q);
    return p1 - q1 || p2 - q2;
  });

  const used = units.slice(0, n);
  const cells = used.map((u) => ({
    x: x0 + u.c * step,
    y: y0 + u.r * step + (u.r >= split ? band : 0),
    size: u.span * tile + (u.span - 1) * gap,
  }));

  // Une derniere ligne (ou colonne) incomplete est centree plutot que calee a
  // gauche (ou en haut). En diagonale, les cases vides restent dans le coin.
  if (large.length === 0 && used.length > 0 && flow !== "diagonal") {
    const axis = flow === "rows" ? "r" : "c";
    const lineLength = flow === "rows" ? cols : rows;
    const last = used[used.length - 1][axis];
    const inLast = used.filter((u) => u[axis] === last).length;
    const available = units.filter((u) => u[axis] === last).length;
    if (inLast < available) {
      const shift = ((lineLength - inLast) * step) / 2;
      used.forEach((u, i) => {
        if (u[axis] !== last) return;
        if (flow === "rows") cells[i].x += shift;
        else cells[i].y += shift;
      });
    }
  }

  let caption: PosterLayout["caption"] = null;
  if (position === "framed" && block) {
    const w = block.cols * step - gap;
    const h = block.rows * step - gap;
    caption = {
      x: x0 + block.c0 * step + w / 2,
      y: y0 + block.r0 * step + h / 2,
      size: Math.min(h * 0.3, (w * 0.86) / measure(text)),
    };
  } else if (position) {
    const y =
      position === "top"
        ? y0 + band / 2
        : position === "bottom"
          ? y0 + gridH + band / 2
          : y0 + split * step - gap / 2 + band / 2;
    caption = {
      x: x0 + gridW / 2,
      y,
      size: Math.min(baseSize, (areaW * 0.9) / measure(text)),
    };
  }

  return {
    width,
    height,
    cols,
    rows,
    tile,
    cells,
    large: used.filter((u) => u.span === 2).length,
    caption,
  };
}
