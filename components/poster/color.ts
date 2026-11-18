/*
 * Couleur dominante d'une pochette, et ordre chromatique des pochettes.
 *
 * Tout se calcule dans OKLab, un espace ou les distances suivent a peu pres la
 * perception : deux teintes voisines en angle y paraissent voisines a l'oeil,
 * ce qui n'est pas le cas en RGB ni meme en HSL, ou les jaunes et les bleus
 * de meme "luminosite" n'ont rien a voir.
 *
 * La pochette est reduite a quelques dizaines de pixels de cote, puis chaque
 * pixel est range dans un casier : une tranche de luminosite pour les gris,
 * une tranche de teinte et de luminosite pour les couleurs. Le casier le plus
 * rempli l'emporte, et sa couleur moyenne est la couleur dominante. Les pixels
 * colores pesent un peu plus que les gris, sans quoi un fond blanc ou noir
 * l'emporterait sur presque toutes les pochettes.
 */

export interface CoverColor {
  /** Luminosite OKLab, de 0 (noir) a 1 (blanc). */
  l: number;
  /** Chroma OKLCH : 0 pour un gris, autour de 0,3 pour une couleur vive. */
  c: number;
  /** Teinte OKLCH en degres. */
  h: number;
  hex: string;
}

const SAMPLE = 40;
// Marge ignoree sur chaque bord : les scans gardent souvent un liseret blanc.
const TRIM = 0.04;
// En dessous, un pixel est tenu pour gris.
const NEUTRAL_CHROMA = 0.05;
// Une pochette dominee par une couleur tres sombre se range avec les noirs.
const BLACK_LIGHTNESS = 0.22;
const HUE_BINS = 12;
// Point de depart de l'arc-en-ciel : juste avant les rouges.
const HUE_START = 10;

const LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function toOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = LINEAR[r];
  const lg = LINEAR[g];
  const lb = LINEAR[b];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function toHex(L: number, a: number, b: number): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    linear
      .map((c) => {
        const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/**
 * Couleur dominante d'une image deja chargee.
 *
 * L'image doit etre de meme origine que la page : une image d'un autre
 * domaine, servie sans en-tete CORS, rend le canvas illisible et
 * getImageData leve une SecurityError.
 */
export function dominantColor(img: HTMLImageElement): CoverColor {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2d indisponible");

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  ctx.drawImage(img, w * TRIM, h * TRIM, w * (1 - 2 * TRIM), h * (1 - 2 * TRIM), 0, 0, SAMPLE, SAMPLE);
  const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;

  // Casiers 0 a 4 : les gris, par luminosite. Au-dela : teinte x luminosite.
  const bins = 5 + HUE_BINS * 2;
  const weight = new Float64Array(bins);
  const sumL = new Float64Array(bins);
  const sumA = new Float64Array(bins);
  const sumB = new Float64Array(bins);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [L, a, b] = toOklab(data[i], data[i + 1], data[i + 2]);
    const chroma = Math.hypot(a, b);
    let bin: number;
    let pixelWeight: number;
    if (chroma < NEUTRAL_CHROMA) {
      bin = Math.min(4, Math.floor(L * 5));
      pixelWeight = 1;
    } else {
      const hue = (Math.atan2(b, a) * 180) / Math.PI + 360;
      const hueBin = Math.floor((hue % 360) / (360 / HUE_BINS));
      bin = 5 + hueBin * 2 + (L < 0.55 ? 0 : 1);
      pixelWeight = 1 + 3 * chroma;
    }
    weight[bin] += pixelWeight;
    sumL[bin] += L * pixelWeight;
    sumA[bin] += a * pixelWeight;
    sumB[bin] += b * pixelWeight;
  }

  let best = 0;
  for (let i = 1; i < bins; i++) if (weight[i] > weight[best]) best = i;
  const total = weight[best] || 1;
  const L = sumL[best] / total;
  const a = sumA[best] / total;
  const b = sumB[best] / total;
  return {
    l: L,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
    hex: toHex(L, a, b),
  };
}

/*
 * Ordre de l'affiche : les blancs et gris clairs d'abord, puis l'arc-en-ciel
 * du rouge au magenta, puis les gris fonces jusqu'au noir. Les gris n'ont pas
 * de teinte qui veuille dire quelque chose : les trier par angle les
 * disperserait au hasard dans les couleurs.
 */
function rank(color: CoverColor): [number, number] {
  const neutral = color.c < NEUTRAL_CHROMA || color.l < BLACK_LIGHTNESS;
  if (neutral && color.l >= 0.6) return [0, -color.l];
  if (neutral) return [2, -color.l];
  return [1, (color.h - HUE_START + 360) % 360];
}

export function compareColors(x: CoverColor, y: CoverColor): number {
  const [gx, kx] = rank(x);
  const [gy, ky] = rank(y);
  return gx - gy || kx - ky || y.l - x.l;
}

/*
 * Familles de couleurs, pour choisir ce qui entre dans l'affiche.
 *
 * Les gris sont coupes en deux comme dans l'ordre de l'affiche : les clairs
 * vont avec les blancs, les fonces avec les noirs. Les bornes de teinte sont
 * des angles OKLCH : le rose vif tombe vers 350, d'ou sa place avec les
 * violets plutot qu'avec les rouges.
 */
export const FAMILIES = [
  { id: "white", label: "White", fallback: "#f2f2ee" },
  { id: "red", label: "Red", fallback: "#c8312c" },
  { id: "orange", label: "Orange", fallback: "#e08a2c" },
  { id: "yellow", label: "Yellow", fallback: "#e3c23a" },
  { id: "green", label: "Green", fallback: "#4d9a5b" },
  { id: "blue", label: "Blue", fallback: "#2f62b8" },
  { id: "pink", label: "Pink", fallback: "#b04f9a" },
  { id: "black", label: "Black", fallback: "#1c1c1f" },
] as const;

export type Family = (typeof FAMILIES)[number]["id"];

export function familyOf(color: CoverColor): Family {
  const [group] = rank(color);
  if (group === 0) return "white";
  if (group === 2) return "black";
  const h = color.h;
  if (h < 45 || h >= 350) return "red";
  if (h < 80) return "orange";
  if (h < 125) return "yellow";
  if (h < 185) return "green";
  if (h < 280) return "blue";
  return "pink";
}

/** Couleur moyenne d'un ensemble, pour la pastille de sa famille. */
export function averageColor(colors: CoverColor[]): string | null {
  if (colors.length === 0) return null;
  let L = 0;
  let a = 0;
  let b = 0;
  for (const c of colors) {
    const rad = (c.h * Math.PI) / 180;
    L += c.l;
    a += c.c * Math.cos(rad);
    b += c.c * Math.sin(rad);
  }
  const n = colors.length;
  return toHex(L / n, a / n, b / n);
}
